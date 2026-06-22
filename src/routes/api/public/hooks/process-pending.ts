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

interface RedditChild { kind: string; data: any }

async function fetchSubredditListing(sub: string, limit: number, sort: string, topWindow: string): Promise<{ posts: any[]; error?: string }> {
  const validSort = ["new", "hot", "top", "rising", "best"].includes(sort) ? sort : "new";
  const sortPath = validSort === "best" ? "" : validSort;
  const base = `https://www.reddit.com/r/${encodeURIComponent(sub)}/${sortPath}.json`;
  const params = new URLSearchParams({ limit: String(limit), raw_json: "1" });
  if (validSort === "top") params.set("t", ["hour","day","week","month","year","all"].includes(topWindow) ? topWindow : "day");
  const url = `${base}?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": "WKNA49NewsBot/1.0 (intake; +https://wkna49.com)", "Accept": "application/json" } });
  } catch (err: any) {
    return { posts: [], error: `fetch threw: ${err?.message ?? err}` };
  }
  if (!res.ok) {
    const snippet = (await res.text().catch(() => "")).slice(0, 200);
    return { posts: [], error: `HTTP ${res.status} from ${url} :: ${snippet}` };
  }
  const data = await res.json().catch(() => null);
  const children: RedditChild[] = data?.data?.children ?? [];
  return { posts: children.filter((c) => c.kind === "t3").map((c) => c.data) };
}

async function fetchPostWithComments(permalink: string): Promise<{ post: any; comments: any[] } | null> {
  const u = `https://www.reddit.com${permalink.replace(/\/+$/, "")}.json?raw_json=1&limit=200`;
  const res = await fetch(u, { headers: { "User-Agent": "WKNA49NewsBot/1.0 (intake)" } });
  if (!res.ok) return null;
  const data = await res.json();
  const postData = data?.[0]?.data?.children?.[0]?.data;
  if (!postData) return null;
  const out: any[] = [];
  const flatten = (node: any, parent: string | null, depth: number) => {
    if (!node || node.kind !== "t1") return;
    const d = node.data;
    if (!d?.body) return;
    out.push({
      id: d.id,
      parent_id: parent,
      author: d.author ?? "[deleted]",
      body: d.body,
      score: d.score ?? 0,
      created_utc: d.created_utc ?? null,
      depth,
    });
    const replies = d.replies;
    if (replies?.data?.children) for (const c of replies.data.children) flatten(c, d.id, depth + 1);
  };
  for (const c of data?.[1]?.data?.children ?? []) flatten(c, null, 0);
  return { post: postData, comments: out };
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
            posts = await fetchSubredditListing(sub, perSub, sortBy, topWindow);
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
          for (const p of posts) {
            if (knownIds.has(p.id)) { summary.skipped_existing++; continue; }
            const body = (p.selftext ?? "").trim().toLowerCase();
            const title = (p.title ?? "").trim().toLowerCase();
            if (body === "[removed]" || body === "[deleted]" || title === "[removed]" || title === "[deleted]") continue;
            if (knownTitles.has(title)) { summary.skipped_existing++; continue; }
            if ((p.score ?? 0) < minScore) { summary.skipped_low_score++; continue; }
            // Fetch comments for richer source material.
            let comments: any[] = [];
            try {
              const detail = await fetchPostWithComments(p.permalink);
              if (detail) comments = detail.comments;
            } catch { /* fall back to no comments */ }
            const permalink = `https://www.reddit.com${p.permalink}`;
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
