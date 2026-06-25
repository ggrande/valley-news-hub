#!/usr/bin/env node
// Uploads dist-release/wkna49-platform-<VERSION>.zip to Supabase storage
// and inserts a published row in platform_releases.
// Called from .github/workflows/publish-release.yml.

import { promises as fs } from "node:fs";
import path from "node:path";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VERSION,
  CHANNEL = "stable",
  BREAKING = "false",
  SECURITY = "false",
  NOTES = "",
  AUTO_LOG = "",
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VERSION) {
  console.error("Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VERSION");
  process.exit(1);
}

const ZIP = path.join("dist-release", `wkna49-platform-${VERSION}.zip`);
const SHA_FILE = `${ZIP}.sha256`;

const zipBuf = await fs.readFile(ZIP);
const shaLine = await fs.readFile(SHA_FILE, "utf8");
const sha = shaLine.split(/\s+/)[0];
const objectPath = `releases/${VERSION}/wkna49-platform-${VERSION}.zip`;

console.log(`Uploading ${ZIP} (${(zipBuf.length / 1024 / 1024).toFixed(2)} MB) → ${objectPath}`);

const upRes = await fetch(`${SUPABASE_URL}/storage/v1/object/network-releases/${objectPath}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/zip",
    "x-upsert": "true",
  },
  body: zipBuf,
});
if (!upRes.ok) {
  console.error("Upload failed:", upRes.status, await upRes.text());
  process.exit(1);
}
console.log("Upload OK");

const changelog = (NOTES && NOTES.trim()) || `### Changes\n\n${AUTO_LOG || "_No commit log available._"}`;
const row = {
  version: VERSION,
  channel: CHANNEL,
  title: `v${VERSION}`,
  changelog_md: changelog,
  breaking: BREAKING === "true",
  security: SECURITY === "true",
  zip_path: objectPath,
  zip_sha256: sha,
  zip_bytes: zipBuf.length,
  published_at: new Date().toISOString(),
};

const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/platform_releases`, {
  method: "POST",
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation,resolution=merge-duplicates",
  },
  body: JSON.stringify(row),
});
if (!insertRes.ok) {
  console.error("Insert failed:", insertRes.status, await insertRes.text());
  process.exit(1);
}
const inserted = await insertRes.json();
console.log("Inserted platform_releases row:", inserted?.[0]?.id ?? "(ok)");
console.log(`\n✓ Release v${VERSION} published.`);
