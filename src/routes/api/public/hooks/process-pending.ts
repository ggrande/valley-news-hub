import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Public endpoint called every 6h by pg_cron. Drives the Reddit Intake automation:
//   1. (optional) auto-import recent posts from configured subreddits
//   2. (optional) generate AI article drafts for pending intakes
//   3. (optional) generate a photorealistic filler hero image when missing
//   4. (optional) auto-publish drafts that passed moderation
// Authenticated via a private `x-cron-secret` header that matches the
// CRON_SECRET secret (never exposed to the client bundle).

type SettingsMap = Record<string, any>;

async function loadSettings(admin: any): Promise<SettingsMap> {
  const { data } = await admin.from("site_settings").select("key, value");
  const map: SettingsMap = {};
  for (const r of (data as any[]) ?? []) {
    const v = r.value;
    map[r.key] = v && typeof v === "object" && "value" in v ? v.value : v;
  }
  return map;
}

// Reddit source: Arctic Shift archive API (Reddit's public JSON endpoints
// return 403 from worker/edge environments).
const ARCTIC_BASE = "https://arctic-shift.photon-reddit.com/api";
const UA = "WKNA49NewsBot/1.0 (intake; +https://wkna49.com)";
const SIX_HOURS_SEC = 6 * 60 * 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function arcticFetch(path: string, params: Record<string, string>): Promise<any[]> {
  const qs = new URLSearchParams(params).toString();
  const url = `${ARCTIC_BASE}${path}?${qs}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) {
    const snippet = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`Arctic Shift HTTP ${res.status} from ${url} :: ${snippet}`);
  }
  const json = await res.json().catch(() => null);
  const data = Array.isArray(json) ? json : (json?.data ?? []);
  return Array.isArray(data) ? data : [];
}

async function fetchSubredditListing(
  sub: string,
  limit: number,
  _sort: string,
  _topWindow: string,
): Promise<{ posts: any[]; error?: string }> {
  try {
    const out: any[] = [];
    const seen = new Set<string>();
    let before: number | null = null;
    // Cap pages defensively so a misbehaving feed cannot loop forever.
    for (let page = 0; page < 5 && out.length < limit; page++) {
      const params: Record<string, string> = { subreddit: sub, limit: "100" };
      if (before != null) params.before = String(before);
      const batch = await arcticFetch("/posts/search", params);
      if (!batch.length) break;
      let oldest = Infinity;
      for (const p of batch) {
        const ts = typeof p?.created_utc === "number" ? p.created_utc : null;
        if (ts != null && ts < oldest) oldest = ts;
        const key = p?.id ?? p?.name;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(p);
      }
      if (batch.length < 100 || !isFinite(oldest)) break;
      before = Math.floor(oldest) - 1;
      await sleep(250);
    }
    return { posts: out.slice(0, limit) };
  } catch (err: any) {
    return { posts: [], error: err?.message ?? String(err) };
  }
}

async function fetchPostComments(postId: string): Promise<any[]> {
  const out: any[] = [];
  const seen = new Set<string>();
  let before: number | null = null;
  for (let page = 0; page < 10; page++) {
    const params: Record<string, string> = { link_id: `t3_${postId}`, limit: "100" };
    if (before != null) params.before = String(before);
    let batch: any[];
    try {
      batch = await arcticFetch("/comments/search", params);
    } catch {
      break;
    }
    if (!batch.length) break;
    let oldest = Infinity;
    for (const c of batch) {
      const ts = typeof c?.created_utc === "number" ? c.created_utc : null;
      if (ts != null && ts < oldest) oldest = ts;
      const key = c?.id ?? c?.name;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: c.id,
        parent_id: c.parent_id ?? null,
        author: c.author ?? "[deleted]",
        body: c.body ?? "",
        score: c.score ?? 0,
        created_utc: ts,
        depth: 0,
      });
}

const MEDIA_EXT_RE = /\.(jpe?g|png|gif|webp)(?:\?.*)?$/i;
const ALLOWED_CT = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function decodeRedditUrl(u: string): string {
  return u.replace(/&amp;/g, "&");
}

function extractMediaUrls(p: any): string[] {
  const urls: string[] = [];
  const push = (u?: string | null) => {
    if (!u) return;
    const clean = decodeRedditUrl(u);
    if (!urls.includes(clean)) urls.push(clean);
  };

  if (typeof p?.url === "string" && MEDIA_EXT_RE.test(p.url)) push(p.url);
  if (typeof p?.url_overridden_by_dest === "string" && MEDIA_EXT_RE.test(p.url_overridden_by_dest)) {
    push(p.url_overridden_by_dest);
  }

  // Gallery posts
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

  // Preview images fallback
  const previews = p?.preview?.images;
  if (Array.isArray(previews)) {
    for (const img of previews) {
      const src = img?.source?.url;
      if (src) push(src);
    }
  }

  return urls.slice(0, 6);
}

async function downloadAndUploadMedia(
  admin: any,
  postId: string,
  urls: string[],
): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const ct = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!ALLOWED_CT.has(ct)) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > 15 * 1024 * 1024) continue;
      const ext = ct === "image/jpeg" ? "jpg" : ct.split("/")[1];
      const path = `reddit/${postId}/${i}.${ext}`;
      const { error } = await admin.storage
        .from("news-media")
        .upload(path, buf, { contentType: ct, upsert: true });
      if (error) continue;
      paths.push(path);
    } catch { /* skip this asset */ }
    await sleep(150);
  }
  return paths;
}
    if (batch.length < 100 || !isFinite(oldest)) break;
    before = Math.floor(oldest) - 1;
    await sleep(250);
  }
  return out;
}

export const Route = createFileRoute("/api/public/hooks/process-pending")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || !provided || provided !== expected) {
          return new Response("Forbidden", { status: 403 });
        }

        const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const settings = await loadSettings(admin);

        const enabled = settings.automation_enabled === true;
        if (!enabled) {
          return Response.json({ skipped: true, reason: "automation_disabled" });
        }

        const subsRaw = String(settings.automation_subreddits ?? "WestVirginia,Charleston");
        const subs = subsRaw.split(/[,\s]+/).map((s) => s.replace(/^r\//i, "").trim()).filter(Boolean);
        const perSub = Math.max(1, Math.min(50, Number(settings.automation_posts_per_sub ?? 10)));
        const sortBy = String(settings.automation_sort_by ?? "new");
        const topWindow = String(settings.automation_top_window ?? "day");
        const minScore = Math.max(0, Number(settings.automation_min_score ?? 0));
        const autoGenerate = settings.automation_auto_generate === true;
        const autoFillerImage = settings.automation_auto_filler_image === true;
        const autoPublish = settings.automation_auto_publish === true;
        const generateLimit = Math.max(1, Math.min(50, Number(settings.automation_generate_limit ?? 20)));

        const summary: any = { imported: 0, skipped_existing: 0, skipped_low_score: 0, generated: 0, published: 0, filler_images: 0, errors: [] as string[] };

        // 1. Auto-import recent posts from configured subreddits
        for (const sub of subs) {
          let posts: any[] = [];
          try {
            const result = await fetchSubredditListing(sub, perSub, sortBy, topWindow);
            posts = result.posts;
            if (result.error) summary.errors.push(`listing r/${sub}: ${result.error}`);
          } catch (err: any) {
            summary.errors.push(`listing r/${sub}: ${err?.message ?? err}`);
            continue;
          }
          if (!posts.length) continue;
          const ids = posts.map((p) => p.id);
          const titles = posts.map((p) => (p.title ?? "").trim()).filter(Boolean);
          const [{ data: existingById }, { data: existingByTitle }] = await Promise.all([
            admin.from("reddit_imports").select("reddit_post_id").in("reddit_post_id", ids),
            titles.length
              ? admin.from("reddit_imports").select("original_title").in("original_title", titles)
              : Promise.resolve({ data: [] as any[] }),
          ]);
          const knownIds = new Set((existingById ?? []).map((r: any) => r.reddit_post_id));
          const knownTitles = new Set((existingByTitle ?? []).map((r: any) => (r.original_title ?? "").trim().toLowerCase()));
          const nowSec = Math.floor(Date.now() / 1000);
          for (const p of posts) {
            if (knownIds.has(p.id)) { summary.skipped_existing++; continue; }
            // Wait at least 6 hours after creation so subreddit moderators
            // have time to remove rule-breaking content before we import it.
            if (typeof p.created_utc === "number" && nowSec - p.created_utc < SIX_HOURS_SEC) continue;
            const body = (p.selftext ?? "").trim().toLowerCase();
            const title = (p.title ?? "").trim().toLowerCase();
            if (body === "[removed]" || body === "[deleted]" || title === "[removed]" || title === "[deleted]") continue;
            if (knownTitles.has(title)) { summary.skipped_existing++; continue; }
            if ((p.score ?? 0) < minScore) { summary.skipped_low_score++; continue; }
            // Fetch comments for richer source material (Arctic Shift, by link_id).
            let comments: any[] = [];
            try {
              comments = await fetchPostComments(p.id);
            } catch { /* fall back to no comments */ }
            const permalink = p.permalink
              ? (p.permalink.startsWith("http") ? p.permalink : `https://www.reddit.com${p.permalink}`)
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
              source_score: p.score ?? null,
              link_flair_text: p.link_flair_text ?? null,
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
        }

        if (!autoGenerate) {
          return Response.json(summary);
        }

        // 2. Discard removed/deleted posts before generation
        const { data: pending } = await admin
          .from("reddit_imports")
          .select("id, original_body, original_title")
          .in("import_status", ["new", "parsed"]);
        const removedIds = (pending ?? [])
          .filter((r: any) => {
            const b = (r.original_body ?? "").trim().toLowerCase();
            const t = (r.original_title ?? "").trim().toLowerCase();
            return b === "[removed]" || b === "[deleted]" || t === "[removed]" || t === "[deleted]";
          })
          .map((r: any) => r.id);
        if (removedIds.length) {
          await admin.from("reddit_imports")
            .update({ import_status: "discarded", processing_error: "Source removed/deleted" })
            .in("id", removedIds);
        }

        // 3. Generate articles for pending imports
        const { data: rows } = await admin
          .from("reddit_imports")
          .select("id")
          .in("import_status", ["new", "parsed"])
          .order("original_created_at", { ascending: false, nullsFirst: false })
          .limit(generateLimit);

        const { generateOne } = await import("@/lib/cron-generate.server");
        const { generateFillerImageForPost } = await import("@/lib/filler-image.server");

        for (const r of rows ?? []) {
          let postId: string | null = null;
          let moderationStatus = "review";
          try {
            const res = await generateOne(admin as any, r.id);
            postId = res.postId;
            moderationStatus = res.moderationStatus;
            summary.generated++;
          } catch (err: any) {
            summary.errors.push(`gen ${r.id}: ${err?.message ?? err}`);
            continue;
          }

          if (!postId) continue;

          // 4. Optional filler image when moderation is clear and no hero exists
          if (autoFillerImage && moderationStatus === "clear") {
            try {
              const r2 = await generateFillerImageForPost(admin as any, postId);
              if (!r2.skipped) summary.filler_images++;
            } catch (err: any) {
              summary.errors.push(`filler ${postId}: ${err?.message ?? err}`);
            }
          }

          // 5. Optional auto-publish
          if (autoPublish && moderationStatus === "clear") {
            const { error: pubErr } = await admin
              .from("posts")
              .update({ status: "published", published_at: new Date().toISOString() })
              .eq("id", postId);
            if (pubErr) summary.errors.push(`publish ${postId}: ${pubErr.message}`);
            else summary.published++;
          }
        }

        return Response.json(summary);
      },
    },
  },
});
