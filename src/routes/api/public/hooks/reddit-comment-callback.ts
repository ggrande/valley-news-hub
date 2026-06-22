// HMAC-authenticated callback from the GitHub Actions worker after it tries
// to post a Reddit comment. Records the attempt and updates the notification.

import { createFileRoute } from "@tanstack/react-router";

type CallbackBody = {
  notification_id: string;
  action: "post-comment" | "capture-session";
  status: "succeeded" | "failed" | "login_required" | "challenge_required" | "thread_locked" | "duplicate";
  reddit_comment_id?: string | null;
  reddit_comment_permalink?: string | null;
  log_excerpt?: string | null;
  github_run_id?: string | null;
  github_run_url?: string | null;
  refreshed_cookies?: unknown; // JSON-serializable cookie jar
  session_status?: "active" | "expired" | "challenge_required" | "error";
};

export const Route = createFileRoute("/api/public/hooks/reddit-comment-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ts = request.headers.get("x-worker-timestamp") ?? "";
        const sig = request.headers.get("x-worker-signature") ?? "";
        const body = await request.text();

        const { verifyPayload, encryptString } = await import("@/lib/reddit-automation.server");
        if (!verifyPayload(ts, body, sig)) return new Response("Forbidden", { status: 403 });

        let payload: CallbackBody;
        try { payload = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Persist refreshed cookies (encrypted) if provided
        if (payload.refreshed_cookies) {
          const enc = encryptString(JSON.stringify(payload.refreshed_cookies));
          await supabaseAdmin
            .from("reddit_automation_settings")
            .update({
              session_cookies_encrypted: enc.ciphertext,
              session_cookies_iv: enc.iv,
              session_captured_at: new Date().toISOString(),
              session_status: payload.session_status ?? "active",
              session_last_error: payload.status === "succeeded" ? null : (payload.log_excerpt ?? null),
            })
            .eq("id", true);
        } else if (payload.session_status) {
          await supabaseAdmin
            .from("reddit_automation_settings")
            .update({
              session_status: payload.session_status,
              session_last_error: payload.log_excerpt ?? null,
            })
            .eq("id", true);
        }

        if (payload.action === "capture-session") {
          return Response.json({ ok: true });
        }

        const id = payload.notification_id;
        if (!id) return Response.json({ error: "missing notification_id" }, { status: 400 });

        // Look up current attempt number
        const { data: notif } = await supabaseAdmin
          .from("reddit_comment_notifications")
          .select("attempt_count")
          .eq("id", id)
          .maybeSingle();
        const attemptNo = ((notif as any)?.attempt_count ?? 0) + 1;

        const attemptStatus =
          payload.status === "succeeded" ? "succeeded" :
          payload.status === "login_required" ? "login_required" :
          payload.status === "challenge_required" ? "challenge_required" :
          payload.status === "thread_locked" ? "thread_locked" :
          payload.status === "duplicate" ? "duplicate" :
          "failed";

        await supabaseAdmin.from("reddit_comment_attempts").insert({
          notification_id: id,
          attempt_no: attemptNo,
          finished_at: new Date().toISOString(),
          status: attemptStatus,
          github_run_id: payload.github_run_id ?? null,
          github_run_url: payload.github_run_url ?? null,
          log_excerpt: (payload.log_excerpt ?? "").slice(0, 4000),
        });

        const notifStatus =
          payload.status === "succeeded" ? "posted" :
          payload.status === "duplicate" ? "posted" :
          "failed";

        await supabaseAdmin
          .from("reddit_comment_notifications")
          .update({
            status: notifStatus,
            attempt_count: attemptNo,
            failure_reason: notifStatus === "failed" ? (payload.log_excerpt ?? payload.status) : null,
            reddit_comment_id: payload.reddit_comment_id ?? null,
            reddit_comment_permalink: payload.reddit_comment_permalink ?? null,
            posted_at: notifStatus === "posted" ? new Date().toISOString() : null,
          })
          .eq("id", id);

        return Response.json({ ok: true });
      },
    },
  },
});
