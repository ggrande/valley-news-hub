import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const getRedditAutomationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("reddit_automation_settings").select("*").eq("id", true).maybeSingle();
    return {
      ...(data ?? {}),
      // Redact secrets from the wire
      reddit_password_encrypted: undefined,
      reddit_password_iv: undefined,
      session_cookies_encrypted: undefined,
      session_cookies_iv: undefined,
      has_password: Boolean((data as any)?.reddit_password_encrypted),
      has_session: Boolean((data as any)?.session_cookies_encrypted),
    };
  });

export const updateRedditAutomationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    mode?: "off" | "dry_run" | "approval" | "live";
    enabled?: boolean;
    reddit_username?: string | null;
    reddit_password?: string | null; // plaintext from form; we encrypt
    template_markdown?: string;
    rate_per_hour?: number;
    rate_per_day?: number;
    github_workflow_ref?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptString } = await import("@/lib/reddit-automation.server");

    const patch: Record<string, any> = {};
    if (data.mode !== undefined) patch.mode = data.mode;
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.reddit_username !== undefined) patch.reddit_username = data.reddit_username;
    if (data.template_markdown !== undefined) patch.template_markdown = data.template_markdown;
    if (data.rate_per_hour !== undefined) patch.rate_per_hour = data.rate_per_hour;
    if (data.rate_per_day !== undefined) patch.rate_per_day = data.rate_per_day;
    if (data.github_workflow_ref !== undefined) patch.github_workflow_ref = data.github_workflow_ref;

    if (data.reddit_password) {
      const enc = encryptString(data.reddit_password);
      patch.reddit_password_encrypted = enc.ciphertext;
      patch.reddit_password_iv = enc.iv;
    }

    const { error } = await supabaseAdmin.from("reddit_automation_settings").update(patch as never).eq("id", true);
    if (error) throw error;
    return { ok: true };
  });

export const listRedditNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string; limit?: number }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("reddit_comment_notifications")
      .select("id, post_id, thread_url, subreddit, status, mode_at_enqueue, attempt_count, failure_reason, created_at, posted_at, reddit_comment_permalink, posts!inner(title, slug)")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const getRedditNotification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("reddit_comment_notifications")
      .select("*, posts!inner(title, slug)")
      .eq("id", data.id)
      .maybeSingle();
    const { data: attempts } = await supabaseAdmin
      .from("reddit_comment_attempts")
      .select("*")
      .eq("notification_id", data.id)
      .order("attempt_no", { ascending: true });
    return { notification: row, attempts: attempts ?? [] };
  });

export const approveRedditNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { dispatchGitHubWorkflow } = await import("@/lib/reddit-automation.server");

    const { data: row } = await supabaseAdmin
      .from("reddit_comment_notifications")
      .select("id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Notification not found");
    if (row.status !== "awaiting_approval" && row.status !== "queued") {
      throw new Error(`Cannot approve from status: ${row.status}`);
    }

    await supabaseAdmin
      .from("reddit_comment_notifications")
      .update({ approved_by: context.userId, approved_at: new Date().toISOString(), status: "dispatched", dispatched_at: new Date().toISOString() })
      .eq("id", data.id);

    const dispatch = await dispatchGitHubWorkflow({ notificationId: data.id, eventType: "reddit-comment" });
    if (!dispatch.ok) {
      await supabaseAdmin
        .from("reddit_comment_notifications")
        .update({ status: "failed", failure_reason: dispatch.error })
        .eq("id", data.id);
      throw new Error(dispatch.error);
    }
    return { ok: true };
  });

export const skipRedditNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("reddit_comment_notifications")
      .update({ status: "skipped", failure_reason: data.reason ?? "Skipped by admin" })
      .eq("id", data.id);
    return { ok: true };
  });

export const retryRedditNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { dispatchGitHubWorkflow } = await import("@/lib/reddit-automation.server");
    await supabaseAdmin
      .from("reddit_comment_notifications")
      .update({ status: "dispatched", dispatched_at: new Date().toISOString(), failure_reason: null })
      .eq("id", data.id);
    const dispatch = await dispatchGitHubWorkflow({ notificationId: data.id, eventType: "reddit-comment" });
    if (!dispatch.ok) {
      await supabaseAdmin
        .from("reddit_comment_notifications")
        .update({ status: "failed", failure_reason: dispatch.error })
        .eq("id", data.id);
      throw new Error(dispatch.error);
    }
    return { ok: true };
  });

export const captureRedditSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { dispatchGitHubWorkflow } = await import("@/lib/reddit-automation.server");
    const dispatch = await dispatchGitHubWorkflow({ notificationId: "session-capture", eventType: "reddit-capture-session" });
    if (!dispatch.ok) throw new Error(dispatch.error);
    return { ok: true };
  });
