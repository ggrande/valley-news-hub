// Heuristic curator that turns the raw `parsed_comments` JSON on a
// reddit_imports row into a clean, in-world Reader Discussion thread for
// the corresponding post. Filters meta/off-topic chatter, preserves the
// original author handles and timestamps, and inserts rows into the
// public.comments table with moderation_status='approved' so they render.
//
// SERVER-ONLY (uses the service-role client passed in).
import type { SupabaseClient } from "@supabase/supabase-js";

// Phrases that signal Reddit-meta / off-topic content rather than an
// in-world reader reaction. Matched case-insensitively against the body.
const META_PATTERNS: RegExp[] = [
  /\breddit(?:ors?)?\b/i,
  /\bsub(?:reddit)?\b/i,
  /\br\/[a-z0-9_]+/i,
  /\bu\/[a-z0-9_-]+/i,
  /\bupvot/i,
  /\bdownvot/i,
  /\bkarma\b/i,
  /\bOP\b/,
  /\bmod(?:s|erator|erators)?\b/i,
  /\bcross[- ]?post/i,
  /\brepost/i,
  /\bthis (?:thread|post|sub|comment|subreddit)\b/i,
  /\bcomment section\b/i,
  /\bbrigad/i,
  /\bautomod/i,
  /\[deleted\]/i,
  /\[removed\]/i,
  /^\s*edit\s*[:\-]/im,
  /^\s*edited\s*[:\-]/im,
  /\btl;?dr\b/i,
];

const META_AUTHORS = new Set([
  "[deleted]",
  "automoderator",
  "auto-moderator",
  "",
]);

const MIN_LEN = 25;
const MAX_LEN = 1200;
const MAX_PER_POST = 15;

type ParsedComment = {
  id?: string;
  author?: string;
  body?: string;
  score?: number;
  // Either an ISO string (Arctic Shift normalisation) or epoch seconds (raw).
  created_at?: string | null;
  created_utc?: number | null;
  parent_id?: string | null;
  depth?: number;
};

function isInWorld(c: ParsedComment): boolean {
  const body = (c.body ?? "").trim();
  if (!body) return false;
  if (body.length < MIN_LEN || body.length > MAX_LEN) return false;
  const author = (c.author ?? "").toLowerCase();
  if (META_AUTHORS.has(author)) return false;
  for (const re of META_PATTERNS) if (re.test(body)) return false;
  return true;
}

function commentTimestamp(c: ParsedComment, fallbackIso: string | null): string | null {
  if (typeof c.created_at === "string" && c.created_at) return c.created_at;
  if (typeof c.created_utc === "number" && isFinite(c.created_utc)) {
    return new Date(c.created_utc * 1000).toISOString();
  }
  return fallbackIso;
}

/**
 * Replace any existing comments for `postId` with a freshly-curated set
 * sourced from `parsed`. Idempotent — safe to call repeatedly.
 *
 * `fallbackIso` is used when an individual comment is missing its own
 * timestamp (rare); pass the post's published_at.
 */
export async function curateAndInsertComments(
  admin: SupabaseClient,
  postId: string,
  parsed: ParsedComment[] | null | undefined,
  fallbackIso: string | null,
): Promise<number> {
  const list = Array.isArray(parsed) ? parsed : [];
  if (!list.length) return 0;

  const kept = list
    .filter(isInWorld)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, MAX_PER_POST)
    // After picking by score, render chronologically.
    .sort((a, b) => {
      const ta = Date.parse(commentTimestamp(a, fallbackIso) ?? "") || 0;
      const tb = Date.parse(commentTimestamp(b, fallbackIso) ?? "") || 0;
      return ta - tb;
    });

  if (!kept.length) return 0;

  // Clear any prior imported comments for this post so re-runs don't dup.
  await admin
    .from("comments")
    .delete()
    .eq("post_id", postId)
    .eq("source_type", "reddit");

  const rows = kept.map((c, i) => ({
    post_id: postId,
    source_type: "reddit" as const,
    source_comment_id: c.id ?? null,
    parent_source_comment_id: null,
    parent_comment_id: null,
    display_name: c.author && c.author !== "[deleted]" ? c.author : "Reader",
    body: (c.body ?? "").trim(),
    score: c.score ?? 0,
    source_created_at: commentTimestamp(c, fallbackIso),
    nesting_level: 0,
    is_featured: i === 0,
    is_hidden: false,
    moderation_status: "approved" as const,
    sort_order: i,
  }));

  const { error } = await admin.from("comments").insert(rows);
  if (error) throw new Error(`comments insert: ${error.message}`);
  return rows.length;
}
