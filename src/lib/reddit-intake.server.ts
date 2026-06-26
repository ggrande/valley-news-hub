// Shared Reddit-post import loop. Both the cron pipeline (process-pending)
// and the cookie-based listing callback feed posts in here so dedupe,
// comment fetch, media upload, and row insertion stay consistent.
//
// Server-only. Always `await import("@/lib/reddit-intake.server")` from
// route/handler bodies.

const ARCTIC_BASE = "https://arctic-shift.photon-reddit.com/api";
const UA = "WKNA49NewsBot/1.0 (intake; +https://wkna49.com)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MEDIA_EXT_RE = /\.(jpe?g|png|gif|webp)(?:\?.*)?$/i;
const ALLOWED_CT = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function decodeRedditUrl(u: string): string { return u.replace(/&amp;/g, "&"); }

function extractMediaUrls(p: any): string[] {
  const urls: string[] = [];
  const push = (u?: string | null) => {
    if (!u) return;
    const clean = decodeRedditUrl(u);
    if (!urls.includes(clean)) urls.push(clean);
  };
  if (typeof p?.url === "string" && MEDIA_EXT_RE.test(p.url)) push(p.url);
  if (typeof p?.url_overridden_by_dest === "string" && MEDIA_EXT_RE.test(p.url_overridden_by_dest)) push(p.url_overridden_by_dest);
  if (p?.is_gallery && p?.media_metadata && typeof p.media_metadata === "object") {
    const order: string[] = Array.isArray(p?.gallery_data?.items)
      ? p.gallery_data.items.map((it: any) => it?.media_id).filter(Boolean)
      : Object.keys(p.media_metadata);
    for (const id of order) {
      const m = p.media_metadata[id];
      const src = m?.s?.u || m?.s?.gif || m?.p?.[m.p.length - 1]?.u;
      if (src) push(src);
    }
  }
  const previews = p?.preview?.images;
  if (Array.isArray(previews)) for (const img of previews) if (img?.source?.url) push(img.source.url);
  return urls.slice(0, 6);
}

async function downloadAndUploadMedia(admin: any, postId: string, urls: string[]): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const res = await fetch(urls[i], { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const ct = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!ALLOWED_CT.has(ct)) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > 15 * 1024 * 1024) continue;
      const ext = ct === "image/jpeg" ? "jpg" : ct.split("/")[1];
      const path = `reddit/${postId}/${i}.${ext}`;
      const { error } = await admin.storage.from("news-media").upload(path, buf, { contentType: ct, upsert: true });
      if (error) continue;
      paths.push(path);
    } catch { /* skip */ }
    await sleep(150);
  }
  return paths;
}

async function arcticFetch(path: string, params: Record<string, string>): Promise<any[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${ARCTIC_BASE}${path}?${qs}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  const data = Array.isArray(json) ? json : (json?.data ?? []);
  return Array.isArray(data) ? data : [];
}

async function fetchPostComments(postId: string): Promise<any[]> {
  const out: any[] = [];
  const seen = new Set<string>();
  let before: number | null = null;
  for (let page = 0; page < 10; page++) {
    const params: Record<string, string> = {
      link_id: `t3_${postId}`, limit: "100", sort: "desc", sort_type: "created_utc",
    };
    if (before != null) params.before = String(before);
    const batch = await arcticFetch("/comments/search", params);
    if (!batch.length) break;
    let oldest = Infinity;
    for (const c of batch) {
      const ts = typeof c?.created_utc === "number" ? c.created_utc : null;
      if (ts != null && ts < oldest) oldest = ts;
      const key = c?.id ?? c?.name;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: c.id, parent_id: c.parent_id ?? null,
        author: c.author ?? "[deleted]", body: c.body ?? "",
        score: c.score ?? 0, created_utc: ts, depth: 0,
      });
    }
    if (batch.length < 100 || !isFinite(oldest)) break;
    before = Math.floor(oldest) - 1;
    await sleep(250);
  }
  return out;
}

export type ImportSummary = {
  imported: number;
  skipped_existing: number;
  skipped_low_score: number;
  skipped_moderation_hold: number;
  errors: string[];
};

export type ImportOptions = {
  /** Skip posts whose score is below this threshold. */
  minScore?: number;
  /** Skip posts younger than this many seconds (moderation hold). */
  moderationHoldSec?: number;
};

/**
 * Insert Reddit posts into reddit_imports (with dedupe, media, comments).
 * Accepts the flat post shape returned by reddit's .json endpoint (data.children[].data)
 * or Arctic Shift archive rows — they share field names (id, title, selftext, etc.).
 */
export async function importRedditPosts(admin: any, posts: any[], options: ImportOptions = {}): Promise<ImportSummary> {
  const summary: ImportSummary = { imported: 0, skipped_existing: 0, skipped_low_score: 0, skipped_moderation_hold: 0, errors: [] };
  const minScore = Math.max(0, options.minScore ?? 0);
  const moderationHoldSec = Math.max(0, options.moderationHoldSec ?? 0);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!posts.length) return summary;

  const ids = posts.map((p) => p?.id).filter(Boolean) as string[];
  const titles = posts.map((p) => (p?.title ?? "").trim()).filter(Boolean);
  const [{ data: existingById }, { data: existingByTitle }] = await Promise.all([
    admin.from("reddit_imports").select("reddit_post_id").in("reddit_post_id", ids),
    titles.length
      ? admin.from("reddit_imports").select("original_title").in("original_title", titles)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const knownIds = new Set((existingById ?? []).map((r: any) => r.reddit_post_id));
  const knownTitles = new Set((existingByTitle ?? []).map((r: any) => (r.original_title ?? "").trim().toLowerCase()));

  for (const p of posts) {
    if (!p?.id) continue;
    if (knownIds.has(p.id)) { summary.skipped_existing++; continue; }
    const body = (p.selftext ?? "").trim().toLowerCase();
    const title = (p.title ?? "").trim().toLowerCase();
    if (body === "[removed]" || body === "[deleted]" || title === "[removed]" || title === "[deleted]") continue;
    if (knownTitles.has(title)) { summary.skipped_existing++; continue; }
    if (moderationHoldSec > 0 && typeof p.created_utc === "number" && nowSec - p.created_utc < moderationHoldSec) {
      summary.skipped_moderation_hold++;
      continue;
    }
    if (minScore > 0 && (typeof p.score !== "number" || p.score < minScore)) {
      summary.skipped_low_score++;
      continue;
    }

    let comments: any[] = [];
    try { comments = await fetchPostComments(p.id); } catch { /* none */ }

    let mediaPaths: string[] = [];
    try {
      const urls = extractMediaUrls(p);
      if (urls.length) mediaPaths = await downloadAndUploadMedia(admin, p.id, urls);
    } catch (err: any) {
      summary.errors.push(`media ${p.id}: ${err?.message ?? err}`);
    }

    const permalink = p.permalink
      ? (String(p.permalink).startsWith("http") ? p.permalink : `https://www.reddit.com${p.permalink}`)
      : `https://www.reddit.com/r/${p.subreddit}/comments/${p.id}/`;

    const { data: imp, error: insErr } = await admin.from("reddit_imports").insert({
      source_url: permalink,
      permalink,
      subreddit: p.subreddit,
      reddit_post_id: p.id,
      original_title: p.title,
      original_body: p.selftext ?? "",
      original_author_display: p.author,
      original_created_at: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
      source_score: typeof p.score === "number" ? p.score : null,
      current_score: typeof p.score === "number" ? p.score : null,
      link_flair_text: p.link_flair_text ?? null,
      media_paths: mediaPaths,
      import_status: "new",
    }).select("id").single();
    if (insErr || !imp) { summary.errors.push(`insert ${p.id}: ${insErr?.message}`); continue; }

    if (comments.length) {
      const rows = comments.map((c) => ({
        reddit_import_id: imp.id,
        source_comment_id: c.id ?? null,
        parent_source_comment_id: c.parent_id ?? null,
        display_name: c.author ?? "redditor",
        body: c.body,
        score: c.score ?? null,
        source_created_at: c.created_utc ? new Date(c.created_utc * 1000).toISOString() : null,
        nesting_level: c.depth ?? 0,
      }));
      await admin.from("reddit_import_comments").insert(rows);
      await admin.from("reddit_imports").update({ parsed_comments: comments }).eq("id", imp.id);
    }
    summary.imported++;
  }
  return summary;
}
