// HMAC-authenticated callback from the listing worker. Persists refreshed
// cookies, stores the raw listing JSON on the job row, and runs the same
// intake import loop used by the cron — but with live Reddit data.

import { createFileRoute } from "@tanstack/react-router";

type CallbackBody = {
  job_id: string;
  status: "succeeded" | "failed";
  posts?: any[];
  error?: string | null;
  github_run_url?: string | null;
  refreshed_cookies?: unknown;
  session_status?: "active" | "expired" | "challenge_required" | "error";
};

export const Route = createFileRoute("/api/public/hooks/reddit-listing-callback")({
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
        if (!payload.job_id) return Response.json({ error: "missing job_id" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Refresh session cookies whenever the worker returned a jar.
        if (payload.refreshed_cookies && Array.isArray(payload.refreshed_cookies) && (payload.refreshed_cookies as any[]).length) {
          const enc = encryptString(JSON.stringify(payload.refreshed_cookies));
          await supabaseAdmin
            .from("reddit_automation_settings")
            .update({
              session_cookies_encrypted: enc.ciphertext,
              session_cookies_iv: enc.iv,
              session_captured_at: new Date().toISOString(),
              session_status: payload.session_status ?? "active",
              session_last_error: payload.status === "succeeded" ? null : (payload.error ?? null),
            })
            .eq("id", true);
        } else if (payload.session_status) {
          await supabaseAdmin
            .from("reddit_automation_settings")
            .update({
              session_status: payload.session_status,
              session_last_error: payload.error ?? null,
            })
            .eq("id", true);
        }

        if (payload.status !== "succeeded" || !Array.isArray(payload.posts)) {
          await supabaseAdmin
            .from("reddit_listing_jobs")
            .update({
              status: "failed",
              error: payload.error ?? "Worker reported failure",
              github_run_url: payload.github_run_url ?? null,
              completed_at: new Date().toISOString(),
            })
            .eq("id", payload.job_id);
          return Response.json({ ok: true });
        }

        // 2. Run the intake import loop against the live posts.
        const { importRedditPosts } = await import("@/lib/reddit-intake.server");
        let imported = 0;
        let error: string | null = null;
        try {
          const r = await importRedditPosts(supabaseAdmin as any, payload.posts);
          imported = r.imported;
        } catch (err: any) {
          error = err?.message ?? String(err);
        }

        await supabaseAdmin
          .from("reddit_listing_jobs")
          .update({
            status: error ? "failed" : "succeeded",
            posts_count: payload.posts.length,
            imported_count: imported,
            error,
            github_run_url: payload.github_run_url ?? null,
            completed_at: new Date().toISOString(),
          })
          .eq("id", payload.job_id);

        return Response.json({ ok: true, imported });
      },
    },
  },
});
