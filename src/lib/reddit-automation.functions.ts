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

// Accept cookies pasted from the browser. Supports several common shapes:
//  - Playwright/Cookie-Editor JSON array: [{name,value,domain,path,...}, ...]
//  - EditThisCookie JSON: same as above
//  - Raw "Cookie:" header: "name=value; name2=value2"
// Normalizes to Playwright's addCookies() shape and encrypts at rest.
export const setRedditSessionCookies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { raw: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptString } = await import("@/lib/reddit-automation.server");

    const raw = (data.raw ?? "").trim();
    if (!raw) throw new Error("No cookie data provided");

    type C = { name: string; value: string; domain?: string; path?: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: "Strict" | "Lax" | "None" };
    let cookies: C[] = [];

    if (raw.startsWith("[") || raw.startsWith("{")) {
      let parsed: any;
      try { parsed = JSON.parse(raw); } catch (e: any) { throw new Error(`Invalid JSON: ${e?.message}`); }
      const arr: any[] = Array.isArray(parsed) ? parsed : (parsed.cookies ?? []);
      cookies = arr.map((c: any) => ({
        name: String(c.name),
        value: String(c.value),
        domain: c.domain ?? ".reddit.com",
        path: c.path ?? "/",
        expires: typeof c.expires === "number" ? c.expires : (typeof c.expirationDate === "number" ? Math.floor(c.expirationDate) : undefined),
        httpOnly: Boolean(c.httpOnly),
        secure: c.secure !== false,
        sameSite: (["Strict","Lax","None"].includes(c.sameSite) ? c.sameSite : "Lax") as "Strict" | "Lax" | "None",
      })).filter((c: C) => c.name && c.value);
    } else {
      const stripped = raw.replace(/^cookie:\s*/i, "");
      cookies = stripped.split(/;\s*/).map((pair) => {
        const idx = pair.indexOf("=");
        if (idx < 0) return null;
        return { name: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim(), domain: ".reddit.com", path: "/", secure: true, sameSite: "Lax" as const };
      }).filter(Boolean) as C[];
    }

    if (!cookies.length) throw new Error("No valid cookies found in input");
    const hasSession = cookies.some((c) => /reddit_session|token_v2|session_tracker|edgebucket|loid/i.test(c.name));
    if (!hasSession) throw new Error(`Cookies don't look like a Reddit session (found: ${cookies.map(c=>c.name).slice(0,10).join(", ")})`);

    const enc = encryptString(JSON.stringify(cookies));
    const { error } = await supabaseAdmin
      .from("reddit_automation_settings")
      .update({
        session_cookies_encrypted: enc.ciphertext,
        session_cookies_iv: enc.iv,
        session_captured_at: new Date().toISOString(),
        session_status: "active",
        session_last_error: null,
      } as never)
      .eq("id", true);
    if (error) throw error;
    return { ok: true, count: cookies.length, names: cookies.map((c) => c.name) };
  });

// Diagnostic: query GitHub Actions for this repo and return recent workflow runs
// so an admin can see whether dispatches are actually starting workflows.
export const debugGitHubStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const pat = process.env.GH_DISPATCH_PAT;
    const repo = process.env.GITHUB_REPO;
    if (!pat) return { ok: false, error: "GH_DISPATCH_PAT not set" };
    if (!repo) return { ok: false, error: "GITHUB_REPO not set" };

    // 1. Repo metadata (verifies PAT can read this repo, and tells us the default branch)
    const repoRes = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "User-Agent": "wkna49" },
    });
    const repoBody: any = await repoRes.json().catch(() => ({}));

    // 2. Workflows list (does GH see reddit-comment.yml on the default branch?)
    const wfRes = await fetch(`https://api.github.com/repos/${repo}/actions/workflows`, {
      headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "User-Agent": "wkna49" },
    });
    const wfBody: any = await wfRes.json().catch(() => ({}));

    // 3. Recent runs (any runs in the last hour?)
    const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=10`, {
      headers: { Authorization: `Bearer ${pat}`, Accept: "application/vnd.github+json", "User-Agent": "wkna49" },
    });
    const runsBody: any = await runsRes.json().catch(() => ({}));

    // 4. Test dispatch a no-op event to confirm the API call succeeds end-to-end
    const dispRes = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "wkna49",
      },
      body: JSON.stringify({ event_type: "reddit-capture-session", client_payload: { notification_id: "session-capture", ts: Date.now(), source: "debug" } }),
    });
    const dispText = await dispRes.text().catch(() => "");

    return {
      ok: true,
      repo: {
        configured: repo,
        api_status: repoRes.status,
        full_name: repoBody?.full_name ?? null,
        default_branch: repoBody?.default_branch ?? null,
        permissions: repoBody?.permissions ?? null,
        error: repoRes.ok ? null : (repoBody?.message ?? "unknown"),
      },
      workflows: {
        api_status: wfRes.status,
        count: wfBody?.total_count ?? null,
        names: (wfBody?.workflows ?? []).map((w: any) => ({ name: w.name, path: w.path, state: w.state })),
      },
      recent_runs: (runsBody?.workflow_runs ?? []).slice(0, 5).map((r: any) => ({
        name: r.name,
        event: r.event,
        status: r.status,
        conclusion: r.conclusion,
        created_at: r.created_at,
        html_url: r.html_url,
      })),
      test_dispatch: {
        api_status: dispRes.status, // expect 204 on success
        body: dispText.slice(0, 300),
      },
    };
  });

