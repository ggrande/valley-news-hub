// Called from publishPost when a Reddit-sourced article is published.
// Decides — based on automation mode + rate limits — whether to enqueue a
// notification comment, and whether to dispatch it immediately.

import { renderTemplate, normalizeThreadUrl, dispatchGitHubWorkflow } from "@/lib/reddit-automation.server";

type Admin = Awaited<ReturnType<typeof import("@/integrations/supabase/client.server").supabaseAdmin["from"] extends any ? any : never>>;

export async function enqueueRedditNotification(admin: any, postId: string): Promise<{ enqueued: boolean; reason?: string }> {
  // 1. Load settings
  const { data: settings } = await admin
    .from("reddit_automation_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (!settings) return { enqueued: false, reason: "no settings" };
  if (!settings.enabled || settings.mode === "off") return { enqueued: false, reason: "automation off" };

  // 2. Load the post + its Reddit thread URL
  const { data: post } = await admin
    .from("posts")
    .select("id, title, slug, dek, source_url, original_permalink, source_subreddit, reddit_import_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return { enqueued: false, reason: "post missing" };
  const threadInput: string | null = post.original_permalink || post.source_url;
  const { url: threadUrl, threadId, subreddit } = normalizeThreadUrl(threadInput);
  if (!threadUrl || !threadId) return { enqueued: false, reason: "no reddit thread url" };

  // 3. Dedupe — UNIQUE on post_id already enforces this at DB level, but check
  // first so we can return a clear reason.
  const { data: existing } = await admin
    .from("reddit_comment_notifications")
    .select("id")
    .eq("post_id", postId)
    .maybeSingle();
  if (existing) return { enqueued: false, reason: "already enqueued" };

  // 4. Rate limit check
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: hourCount }, { count: dayCount }] = await Promise.all([
    admin.from("reddit_comment_notifications").select("id", { count: "exact", head: true }).in("status", ["dispatched", "posted"]).gte("dispatched_at", hourAgo),
    admin.from("reddit_comment_notifications").select("id", { count: "exact", head: true }).in("status", ["dispatched", "posted"]).gte("dispatched_at", dayAgo),
  ]);
  if ((hourCount ?? 0) >= (settings.rate_per_hour ?? 4)) return { enqueued: false, reason: "hourly rate cap hit" };
  if ((dayCount ?? 0) >= (settings.rate_per_day ?? 20)) return { enqueued: false, reason: "daily rate cap hit" };

  // 5. Render the comment
  const articleUrl = `https://wkna49.com/news/${post.slug}`;
  const rendered = renderTemplate(settings.template_markdown, {
    article_title: post.title,
    article_url: articleUrl,
    article_dek: post.dek ?? "",
    subreddit: subreddit ?? post.source_subreddit ?? "",
    reddit_thread_url: threadUrl,
  });

  // 6. Decide initial status from mode
  const status =
    settings.mode === "dry_run" ? "dry_run_only" :
    settings.mode === "approval" ? "awaiting_approval" :
    "dispatched";

  const { data: notif, error: insErr } = await admin
    .from("reddit_comment_notifications")
    .insert({
      post_id: postId,
      reddit_import_id: post.reddit_import_id ?? null,
      thread_url: threadUrl,
      thread_id: threadId,
      subreddit: subreddit ?? post.source_subreddit ?? null,
      rendered_comment: rendered,
      mode_at_enqueue: settings.mode,
      status,
      dispatched_at: status === "dispatched" ? new Date().toISOString() : null,
    })
    .select("id")
    .maybeSingle();
  if (insErr || !notif) return { enqueued: false, reason: insErr?.message ?? "insert failed" };

  // 7. Live mode → fire GitHub Actions immediately
  if (settings.mode === "live") {
    const dispatch = await dispatchGitHubWorkflow({ notificationId: notif.id, eventType: "reddit-comment" });
    if (!dispatch.ok) {
      await admin
        .from("reddit_comment_notifications")
        .update({ status: "failed", failure_reason: dispatch.error })
        .eq("id", notif.id);
      return { enqueued: true, reason: `dispatch failed: ${dispatch.error}` };
    }
  }

  return { enqueued: true };
}
