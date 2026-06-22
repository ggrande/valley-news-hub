import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "fs";
import { extname, basename } from "path";

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key, { auth: { persistSession: false } });

const dir = "/tmp/media/media";
const files = readdirSync(dir);
console.log("files:", files.length);

function ct(p: string) {
  const e = extname(p).toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".gif") return "image/gif";
  if (e === ".webp") return "image/webp";
  return "image/jpeg";
}

const byRid = new Map<string, string[]>();

let uploaded = 0, failed = 0;
for (const f of files) {
  const parts = f.split("_");
  const rid = parts[1];
  if (!rid) { console.log("skip (no rid):", f); continue; }
  const path = `manual/${rid}/${f}`;
  const buf = readFileSync(`${dir}/${f}`);
  const { error } = await sb.storage.from("news-media").upload(path, buf, {
    contentType: ct(f),
    upsert: true,
  });
  if (error) { console.log("upload fail", f, error.message); failed++; continue; }
  uploaded++;
  if (!byRid.has(rid)) byRid.set(rid, []);
  byRid.get(rid)!.push(path);
}
console.log("uploaded:", uploaded, "failed:", failed, "unique rids:", byRid.size);

let updImports = 0, updPosts = 0, missing = 0;
for (const [rid, paths] of byRid) {
  const { data: ri, error: e1 } = await sb
    .from("reddit_imports")
    .select("id, generated_post_id, media_paths")
    .eq("reddit_post_id", rid)
    .maybeSingle();
  if (e1) { console.log("ri err", rid, e1.message); continue; }
  if (!ri) { missing++; console.log("no import for", rid); continue; }

  const existing: string[] = Array.isArray(ri.media_paths) ? ri.media_paths : [];
  const merged = Array.from(new Set([...paths, ...existing]));
  const { error: e2 } = await sb
    .from("reddit_imports")
    .update({ media_paths: merged })
    .eq("id", ri.id);
  if (e2) console.log("upd ri err", rid, e2.message);
  else updImports++;

  if (ri.generated_post_id) {
    const heroUrl = `/api/media?p=${encodeURIComponent(paths[0])}`;
    const { error: e3 } = await sb
      .from("posts")
      .update({ featured_image: heroUrl, og_image: heroUrl })
      .eq("id", ri.generated_post_id);
    if (e3) console.log("upd post err", rid, e3.message);
    else updPosts++;
  }
}
console.log("updated imports:", updImports, "updated posts:", updPosts, "missing imports:", missing);
