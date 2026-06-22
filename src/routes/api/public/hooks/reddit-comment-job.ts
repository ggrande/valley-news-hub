// HMAC-authenticated endpoint for the GitHub Actions worker to fetch a job.
// Returns decrypted credentials + session cookies needed to post the comment.
// Never call this from the browser; the worker pre-shares REDDIT_WORKER_WEBHOOK_SECRET.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/reddit-comment-job")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ts = request.headers.get("x-worker-timestamp") ?? "";
        const sig = request.headers.get("x-worker-signature") ?? "";
        const body = await request.text();

        const { verifyPayload, decryptString } = await import("@/lib/reddit-automation.server");
        if (!verifyPayload(ts, body, sig)) {
          return new Response("Forbidden", { status: 403 });
        }

        let payload: { notification_id?: string } = {};
        try { payload = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }
        const id = payload.notification_id;
        if (!id) return new Response("Missing notification_id", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("reddit_automation_settings")
          .select("*")
          .eq("id", true)
          .maybeSingle();
        if (!settings) return Response.json({ error: "Automation not configured" }, { status: 400 });

        const out: Record<string, any> = {
          reddit_username: (settings as any).reddit_username,
          mode: (settings as any).mode,
        };
        try {
          if ((settings as any).reddit_password_encrypted) {
            out.reddit_password = decryptString((settings as any).reddit_password_encrypted, (settings as any).reddit_password_iv);
          }
        } catch (e: any) {
          return Response.json({ error: `Failed to decrypt password: ${e?.message}` }, { status: 500 });
        }
        try {
          if ((settings as any).session_cookies_encrypted) {
            out.session_cookies = JSON.parse(decryptString((settings as any).session_cookies_encrypted, (settings as any).session_cookies_iv));
          }
        } catch { /* corrupt cookies; worker will re-login */ }

        if (id === "session-capture") {
          out.action = "capture-session";
          return Response.json(out);
        }

        const { data: notif } = await supabaseAdmin
          .from("reddit_comment_notifications")
          .select("id, thread_url, rendered_comment, subreddit, attempt_count, status")
          .eq("id", id)
          .maybeSingle();
        if (!notif) return Response.json({ error: "Notification not found" }, { status: 404 });

        out.action = "post-comment";
        out.notification = notif;
        return Response.json(out);
      },
    },
  },
});
