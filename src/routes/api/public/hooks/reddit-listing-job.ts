// HMAC-authenticated endpoint for the GitHub Actions listing worker.
// Returns job parameters + decrypted session cookies so the worker can fetch
// the subreddit listing through the WKNA49 logged-in browser context.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/reddit-listing-job")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ts = request.headers.get("x-worker-timestamp") ?? "";
        const sig = request.headers.get("x-worker-signature") ?? "";
        const body = await request.text();

        const { verifyPayload, decryptString } = await import("@/lib/reddit-automation.server");
        if (!verifyPayload(ts, body, sig)) return new Response("Forbidden", { status: 403 });

        let payload: { job_id?: string } = {};
        try { payload = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }
        if (!payload.job_id) return new Response("Missing job_id", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: job } = await supabaseAdmin
          .from("reddit_listing_jobs")
          .select("*")
          .eq("id", payload.job_id)
          .maybeSingle();
        if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

        const { data: settings } = await supabaseAdmin
          .from("reddit_automation_settings")
          .select("session_cookies_encrypted, session_cookies_iv")
          .eq("id", true)
          .maybeSingle();

        let cookies: any[] = [];
        try {
          if ((settings as any)?.session_cookies_encrypted) {
            cookies = JSON.parse(decryptString((settings as any).session_cookies_encrypted, (settings as any).session_cookies_iv));
          }
        } catch { cookies = []; }

        await supabaseAdmin
          .from("reddit_listing_jobs")
          .update({ status: "dispatched" })
          .eq("id", payload.job_id);

        return Response.json({
          job_id: (job as any).id,
          subreddit: (job as any).subreddit,
          sort: (job as any).sort,
          top_window: (job as any).top_window,
          limit: (job as any).limit_per_sub,
          session_cookies: cookies,
        });
      },
    },
  },
});
