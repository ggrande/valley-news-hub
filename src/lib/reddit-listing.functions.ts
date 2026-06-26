// Admin-only server fns for the cookie-based Reddit listing fetcher.
// Creates a reddit_listing_jobs row and dispatches a GitHub Actions workflow
// that loads the WKNA49 session cookies, scrapes the listing through a real
// browser context, and posts results back to /api/public/hooks/reddit-listing-callback.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const runRedditListingFetch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    subreddit: string;
    sort?: "new" | "hot" | "top" | "rising" | "best";
    top_window?: "hour" | "day" | "week" | "month" | "year" | "all";
    limit?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sub = (data.subreddit ?? "").replace(/^r\//i, "").trim();
    if (!sub) throw new Error("subreddit is required");
    const sort = data.sort ?? "new";
    const limit = Math.max(1, Math.min(100, data.limit ?? 25));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { dispatchListingWorkflow } = await import("@/lib/reddit-automation.server");

    const { data: settings } = await supabaseAdmin
      .from("reddit_automation_settings")
      .select("session_cookies_encrypted, session_status")
      .eq("id", true)
      .maybeSingle();
    if (!(settings as any)?.session_cookies_encrypted) {
      throw new Error("No Reddit session cookies stored. Capture or paste cookies on the Reddit Automation page first.");
    }

    const { data: job, error } = await supabaseAdmin
      .from("reddit_listing_jobs")
      .insert({
        subreddit: sub,
        sort,
        top_window: data.top_window ?? null,
        limit_per_sub: limit,
        status: "queued",
        triggered_by: "manual",
      } as never)
      .select("id")
      .single();
    if (error || !job) throw new Error(error?.message ?? "Failed to create job");

    const dispatch = await dispatchListingWorkflow({ jobId: (job as any).id });
    if (!dispatch.ok) {
      await supabaseAdmin
        .from("reddit_listing_jobs")
        .update({ status: "failed", error: dispatch.error, completed_at: new Date().toISOString() })
        .eq("id", (job as any).id);
      throw new Error(dispatch.error);
    }
    return { ok: true, job_id: (job as any).id };
  });

export const listRedditListingJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("reddit_listing_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 10);
    return rows ?? [];
  });

export const getRedditSessionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("reddit_automation_settings")
      .select("session_status, session_captured_at, session_last_error, session_cookies_encrypted, reddit_username")
      .eq("id", true)
      .maybeSingle();
    return {
      has_session: Boolean((data as any)?.session_cookies_encrypted),
      session_status: (data as any)?.session_status ?? "none",
      session_captured_at: (data as any)?.session_captured_at ?? null,
      session_last_error: (data as any)?.session_last_error ?? null,
      reddit_username: (data as any)?.reddit_username ?? null,
    };
  });
