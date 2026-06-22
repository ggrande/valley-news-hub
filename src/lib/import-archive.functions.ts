import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { unzipSync, strFromU8 } from "fflate";

type RedditPost = {
  reddit_id?: string;
  id?: string;
  subreddit?: string;
  author_id?: string;
  author?: string;
  title?: string;
  body?: string;
  selftext?: string;
  created_at?: string | number;
  created_utc?: number;
  permalink?: string;
  link_flair_text?: string | null;
  score?: number;
  raw_json?: any;
};

type RedditComment = {
  reddit_id?: string;
  id?: string;
  source_post_id?: string;
  parent_post_id?: string;
  author_id?: string;
  author?: string;
  body?: string;
  created_at?: string | number;
  created_utc?: number;
  parent_id?: string | null;
  score?: number;
  raw_json?: any;
};

type MediaManifestEntry = {
  reddit_id?: string;
  post_id?: string;
  path?: string;
  filename?: string;
  url?: string;
  content_type?: string;
};

const ALLOWED_MEDIA_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function toIso(value: any): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function pickPostId(p: RedditPost): string | null {
  return (p.reddit_id || p.id || p.raw_json?.id || p.raw_json?.name || null) as string | null;
}

function ext(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

export const processArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { storagePath: string; label?: string }) => input)
  .handler(async ({ data, context }) => {
    // Admin check
    const { data: roleRow } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!roleRow) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Download ZIP
    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from("reddit-archives")
      .download(data.storagePath);
    if (dlErr || !blob) throw new Error(`Could not read archive: ${dlErr?.message ?? "missing"}`);
    const buf = new Uint8Array(await blob.arrayBuffer());

    // Create batch row
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from("import_batches")
      .insert({
        label: data.label ?? data.storagePath.split("/").pop() ?? "import",
        source_filename: data.storagePath,
        size_bytes: buf.byteLength,
        status: "processing",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (batchErr || !batch) throw new Error(batchErr?.message ?? "Could not create batch");
    const batchId = batch.id;

    try {
      const files = unzipSync(buf, {
        filter: (f) => f.size < 80 * 1024 * 1024,
      });

      // Locate JSON manifests (paths may use either / or \)
      const norm = (k: string) => k.replace(/\\/g, "/").toLowerCase();
      const findFile = (suffix: string) =>
        Object.keys(files).find((k) => norm(k).endsWith(suffix));

      const postsKey = findFile("all_posts.json");
      const commentsKey = findFile("all_comments.json");
      const mediaManifestKey = findFile("media_manifest.json");

      if (!postsKey) throw new Error("all_posts.json not found in archive");

      const posts: RedditPost[] = JSON.parse(strFromU8(files[postsKey]));
      const comments: RedditComment[] = commentsKey
        ? JSON.parse(strFromU8(files[commentsKey]))
        : [];
      const mediaManifest: MediaManifestEntry[] = mediaManifestKey
        ? JSON.parse(strFromU8(files[mediaManifestKey]))
        : [];

      // Group comments by post id
      const commentsByPost = new Map<string, RedditComment[]>();
      for (const c of comments) {
        const pid = (c.source_post_id || c.parent_post_id) as string | undefined;
        if (!pid) continue;
        if (!commentsByPost.has(pid)) commentsByPost.set(pid, []);
        commentsByPost.get(pid)!.push(c);
      }

      // Index manifest by post id
      const mediaByPost = new Map<string, MediaManifestEntry[]>();
      for (const m of mediaManifest) {
        const pid = (m.reddit_id || m.post_id) as string | undefined;
        if (!pid) continue;
        if (!mediaByPost.has(pid)) mediaByPost.set(pid, []);
        mediaByPost.get(pid)!.push(m);
      }

      // Upload media files referenced by manifest (or by filename containing post id)
      const mediaKeys = Object.keys(files).filter((k) => {
        const n = norm(k);
        return n.includes("/media/") && ALLOWED_MEDIA_EXT.has(ext(n));
      });

      let totalMedia = 0;
      const mediaPathByPost = new Map<string, string[]>();
      for (const key of mediaKeys) {
        const filename = key.replace(/\\/g, "/").split("/").pop()!;
        // expect filename pattern: <date>_<redditid>_<author>_...
        const parts = filename.split("_");
        const redditId = parts[1];
        if (!redditId) continue;
        const ct =
          ext(filename) === "png"
            ? "image/png"
            : ext(filename) === "gif"
              ? "image/gif"
              : ext(filename) === "webp"
                ? "image/webp"
                : "image/jpeg";
        const targetPath = `${batchId}/${redditId}/${filename}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("news-media")
          .upload(targetPath, files[key], { contentType: ct, upsert: true });
        if (upErr) continue;
        totalMedia++;
        if (!mediaPathByPost.has(redditId)) mediaPathByPost.set(redditId, []);
        mediaPathByPost.get(redditId)!.push(targetPath);
      }

      // Insert reddit_imports + nested comments
      let postCount = 0;
      let commentCount = 0;
      for (const p of posts) {
        const rid = pickPostId(p);
        if (!rid) continue;
        const createdAt =
          toIso(p.created_at) ??
          toIso(p.created_utc) ??
          toIso(p.raw_json?.created_utc) ??
          null;
        const flair = p.link_flair_text ?? p.raw_json?.link_flair_text ?? null;
        const permalink =
          p.permalink ??
          (p.raw_json?.permalink
            ? `https://reddit.com${p.raw_json.permalink}`
            : null);

        const postComments = (commentsByPost.get(rid) ?? []).slice(0, 200).map((c) => ({
          id: c.reddit_id ?? c.id,
          author: c.author_id ?? c.author ?? "anon",
          body: c.body ?? "",
          score: c.score ?? c.raw_json?.score ?? null,
          created_at: toIso(c.created_at) ?? toIso(c.created_utc),
          parent_id: c.parent_id ?? c.raw_json?.parent_id ?? null,
        }));

        const { data: imported, error: insErr } = await supabaseAdmin
          .from("reddit_imports")
          .upsert(
            {
              batch_id: batchId,
              reddit_post_id: rid,
              subreddit: p.subreddit ?? p.raw_json?.subreddit ?? null,
              original_title: p.title ?? "",
              original_body: p.body ?? p.selftext ?? p.raw_json?.selftext ?? "",
              original_author_display:
                p.author_id ?? p.author ?? p.raw_json?.author ?? null,
              original_created_at: createdAt,
              source_score: p.score ?? p.raw_json?.score ?? null,
              permalink,
              link_flair_text: flair,
              parsed_comments: postComments,
              media_paths: mediaPathByPost.get(rid) ?? [],
              source_url: permalink,
              import_status: "new",
              moderation_status: "pending",
              created_by: context.userId,
            },
            { onConflict: "reddit_post_id" },
          )
          .select("id")
          .single();
        if (insErr || !imported) continue;
        postCount++;
        commentCount += postComments.length;
      }

      await supabaseAdmin
        .from("import_batches")
        .update({
          status: "complete",
          total_posts: postCount,
          total_comments: commentCount,
          total_media: totalMedia,
        })
        .eq("id", batchId);

      return {
        batchId,
        totalPosts: postCount,
        totalComments: commentCount,
        totalMedia,
      };
    } catch (err: any) {
      await supabaseAdmin
        .from("import_batches")
        .update({ status: "error", error: String(err?.message ?? err) })
        .eq("id", batchId);
      throw err;
    }
  });

export const listBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("import_batches")
      .select("id, label, status, total_posts, total_comments, total_media, size_bytes, error, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });

export const getBatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: batch, error } = await context.supabase
      .from("import_batches")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    const { data: items } = await context.supabase
      .from("reddit_imports")
      .select("id, reddit_post_id, original_title, link_flair_text, original_created_at, import_status, moderation_status, generated_post_id, processing_error, media_paths")
      .eq("batch_id", data.id)
      .order("original_created_at", { ascending: false });
    return { batch, items: items ?? [] };
  });
