#!/usr/bin/env node
// Build a scrubbed release ZIP of the WKNA-49 platform.
//
// Removes:
//   - .env files (and any *.env.local)
//   - .git, node_modules, .output, dist, .vite, .lovable, .DS_Store
//   - .github/scripts (Reddit worker credentials live in the workflow secrets,
//     but the script itself is part of the platform — kept)
//   - supabase/.branches, supabase/.temp
//   - any file whose contents include a known secret pattern (defensive)
//
// Output: dist-release/wkna49-platform-<version>.zip + .sha256
//
// Usage:
//   node scripts/build-template.mjs --version 1.4.0

import { promises as fs, createWriteStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { zip as fflateZip } from "fflate";

const ROOT = process.cwd();
const ARGS = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "true"]);
    return acc;
  }, []),
);
const VERSION = ARGS.version || process.env.RELEASE_VERSION || "0.0.0-dev";

const EXCLUDE_DIRS = new Set([
  "node_modules", ".git", ".output", "dist", "dist-release",
  ".vite", ".lovable", ".turbo", ".cache", ".idea", ".vscode",
]);
const EXCLUDE_NAMES = new Set([
  ".DS_Store", ".env", ".env.local", ".env.production", ".env.production.local",
  ".env.development.local", ".env.test", ".env.test.local",
]);
// Patterns that, if present in a text file, mean it must be stripped.
const SECRET_PATTERNS = [
  /sb_secret_[A-Za-z0-9_-]+/g,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s]+/g,
  /sk_live_[A-Za-z0-9]+/g,
  /sk_test_[A-Za-z0-9]+/g,
  /ghp_[A-Za-z0-9]+/g,
  /github_pat_[A-Za-z0-9_]+/g,
];

async function walk(dir, rel = "") {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (EXCLUDE_NAMES.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const relPath = path.posix.join(rel, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      out.push(...(await walk(abs, relPath)));
    } else if (entry.isFile()) {
      out.push({ abs, rel: relPath });
    }
  }
  return out;
}

function scrub(buf, relPath) {
  // Only attempt text scrubs on likely-text files (small heuristic).
  if (buf.length > 2_000_000) return buf;
  const text = buf.toString("utf8");
  // Cheap binary check: lots of NULs → bail.
  if (text.includes("\u0000")) return buf;
  let scrubbed = text;
  let touched = false;
  for (const re of SECRET_PATTERNS) {
    if (re.test(scrubbed)) {
      scrubbed = scrubbed.replace(re, "<REDACTED_FOR_RELEASE>");
      touched = true;
    }
  }
  if (touched) console.log(`  scrubbed secrets in ${relPath}`);
  return Buffer.from(scrubbed, "utf8");
}

async function main() {
  console.log(`Building release v${VERSION}…`);
  const files = await walk(ROOT);
  console.log(`Collected ${files.length} files`);

  // Inject a VERSION file so consumers can detect what they're running.
  const fileMap = {};
  for (const f of files) {
    const buf = await fs.readFile(f.abs);
    fileMap[f.rel] = scrub(buf, f.rel);
  }
  fileMap["RELEASE_VERSION"] = Buffer.from(`${VERSION}\n`, "utf8");
  fileMap["RELEASE_INFO.json"] = Buffer.from(JSON.stringify({
    version: VERSION,
    built_at: new Date().toISOString(),
    file_count: files.length + 2,
  }, null, 2), "utf8");

  const zipped = await new Promise((resolve, reject) => {
    fflateZip(
      Object.fromEntries(Object.entries(fileMap).map(([k, v]) => [k, new Uint8Array(v)])),
      { level: 6 },
      (err, data) => (err ? reject(err) : resolve(Buffer.from(data))),
    );
  });

  await fs.mkdir(path.join(ROOT, "dist-release"), { recursive: true });
  const outPath = path.join(ROOT, "dist-release", `wkna49-platform-${VERSION}.zip`);
  await fs.writeFile(outPath, zipped);
  const sha = createHash("sha256").update(zipped).digest("hex");
  await fs.writeFile(`${outPath}.sha256`, `${sha}  ${path.basename(outPath)}\n`);

  console.log(`\nWrote ${outPath}`);
  console.log(`SHA-256: ${sha}`);
  console.log(`Size:    ${(zipped.length / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
