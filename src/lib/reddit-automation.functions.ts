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
  .inputValidator((input: {
    status?: string;
    limit?: number;
    windowHours?: number | null;
    minUpvotes?: number | null;
    sortBy?: "created_at" | "upvotes";
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = data.limit ?? 100;

    let q = supabaseAdmin
      .from("reddit_comment_notifications")
      .select(
        "id, post_id, reddit_import_id, reddit_thread_url:thread_url, subreddit, status, mode_at_enqueue, attempt_count, failure_reason, created_at, posted_at, reddit_comment_permalink, posts!inner(title, slug, status), reddit_imports(current_score, source_score, original_created_at)"
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;

    let enriched = (rows ?? []).map((r: any) => {
      const score = r.reddit_imports?.current_score ?? r.reddit_imports?.source_score ?? null;
      return {
        ...r,
        upvotes: typeof score === "number" ? score : null,
        post_status: r.posts?.status ?? null,
        reddit_posted_at: r.reddit_imports?.original_created_at ?? null,
      };
    });

    // Filter by time window based on the ORIGINAL Reddit post time, not enqueue time
    if (data.windowHours && data.windowHours > 0) {
      const cutoffMs = Date.now() - data.windowHours * 3600_000;
      enriched = enriched.filter((r) => {
        if (!r.reddit_posted_at) return false;
        const t = new Date(r.reddit_posted_at).getTime();
        return Number.isFinite(t) && t >= cutoffMs;
      });
    }

    if (typeof data.minUpvotes === "number" && data.minUpvotes > 0) {
      enriched = enriched.filter((r) => typeof r.upvotes === "number" && r.upvotes >= (data.minUpvotes as number));
    }

    if (data.sortBy === "upvotes") {
      enriched.sort((a, b) => (b.upvotes ?? -1) - (a.upvotes ?? -1));
    } else {
      // Default sort: newest Reddit post time first (fall back to enqueue time)
      enriched.sort((a, b) => {
        const at = a.reddit_posted_at ? new Date(a.reddit_posted_at).getTime() : new Date(a.created_at).getTime();
        const bt = b.reddit_posted_at ? new Date(b.reddit_posted_at).getTime() : new Date(b.created_at).getTime();
        return bt - at;
      });
    }

    return enriched.slice(0, limit);
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
    const normalizeSameSite = (value: unknown): "Strict" | "Lax" | "None" | undefined => {
      const v = String(value ?? "").toLowerCase();
      if (v === "strict") return "Strict";
      if (v === "none" || v === "no_restriction") return "None";
      if (v === "lax") return "Lax";
      return undefined;
    };

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
        sameSite: normalizeSameSite(c.sameSite),
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
    const authCookies = cookies.filter((c) => /(^|[_-])(reddit_session|token_v2)$/i.test(c.name) || /^(reddit_session|token_v2)$/i.test(c.name));
    if (!authCookies.length) throw new Error(`Cookies are missing Reddit's login cookie. Export cookies from a logged-in reddit.com tab; found: ${cookies.map(c=>c.name).slice(0,10).join(", ")}`);
    const now = Math.floor(Date.now() / 1000);
    const expiredAuth = authCookies.every((c) => typeof c.expires === "number" && c.expires > 0 && c.expires <= now);
    if (expiredAuth) throw new Error("Reddit login cookies are already expired. Log in again, then export cookies immediately.");

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

// Refresh the notification queue: re-fetch latest upvote counts for the reddit
// posts behind recent notifications. The queue itself is already joined live
// with posts + reddit_imports, so calling this then re-querying gives an
// up-to-the-minute view of upvotes + post status.
export const refreshNotificationQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { windowHours?: number | null }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { renderTemplate, normalizeThreadUrl } = await import("@/lib/reddit-automation.server");

    // ---- Step 1: BACKFILL — every published reddit-sourced post should have
    // a notification row. Insert missing ones as `awaiting_approval` so admins
    // see the full history in the queue.
    const { data: settings } = await supabaseAdmin
      .from("reddit_automation_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    let postsQ = supabaseAdmin
      .from("posts")
      .select("id, title, slug, dek, source_url, original_permalink, source_subreddit, reddit_import_id, published_at, created_at")
      .eq("status", "published")
      .not("reddit_import_id", "is", null)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1000);
    if (data.windowHours && data.windowHours > 0) {
      const cutoff = new Date(Date.now() - data.windowHours * 3600_000).toISOString();
      postsQ = postsQ.gte("published_at", cutoff);
    }
    const { data: publishedPosts, error: postsErr } = await postsQ;
    if (postsErr) throw postsErr;

    let backfilled = 0;
    if (publishedPosts && publishedPosts.length) {
      const postIds = publishedPosts.map((p: any) => p.id);
      const { data: existingRows } = await supabaseAdmin
        .from("reddit_comment_notifications")
        .select("post_id")
        .in("post_id", postIds);
      const existing = new Set((existingRows ?? []).map((r: any) => r.post_id));
      const tpl = (settings as any)?.template_markdown ?? "";

      const inserts: any[] = [];
      for (const p of publishedPosts as any[]) {
        if (existing.has(p.id)) continue;
        const threadInput: string | null = p.original_permalink || p.source_url;
        const { url: threadUrl, threadId, subreddit } = normalizeThreadUrl(threadInput);
        if (!threadUrl || !threadId) continue;
        const articleUrl = `https://wkna49.com/news/${p.slug}`;
        const rendered = tpl
          ? renderTemplate(tpl, {
              article_title: p.title,
              article_url: articleUrl,
              article_dek: p.dek ?? "",
              subreddit: subreddit ?? p.source_subreddit ?? "",
              reddit_thread_url: threadUrl,
            })
          : `Discussion: [${p.title}](${articleUrl})`;
        inserts.push({
          post_id: p.id,
          reddit_import_id: p.reddit_import_id ?? null,
          thread_url: threadUrl,
          thread_id: threadId,
          subreddit: subreddit ?? p.source_subreddit ?? null,
          rendered_comment: rendered,
          mode_at_enqueue: (settings as any)?.mode ?? "approval",
          status: "awaiting_approval",
        });
      }
      // Insert in chunks to stay under request size limits
      for (let i = 0; i < inserts.length; i += 200) {
        const chunk = inserts.slice(i, i + 200);
        const { error: insErr } = await supabaseAdmin
          .from("reddit_comment_notifications")
          .insert(chunk as never);
        if (!insErr) backfilled += chunk.length;
      }
    }

    // ---- Step 2: REFRESH upvotes for notifications in the chosen window
    let q = supabaseAdmin
      .from("reddit_comment_notifications")
      .select("reddit_import_id, created_at, reddit_imports!inner(id, reddit_post_id)")
      .not("reddit_import_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.windowHours && data.windowHours > 0) {
      const cutoff = new Date(Date.now() - data.windowHours * 3600_000).toISOString();
      q = q.gte("created_at", cutoff);
    }
    const { data: rows, error } = await q;
    if (error) throw error;

    const byPostId = new Map<string, string>();
    for (const r of (rows ?? []) as any[]) {
      const pid = r.reddit_imports?.reddit_post_id;
      const iid = r.reddit_imports?.id;
      if (pid && iid && !byPostId.has(pid)) byPostId.set(pid, iid);
    }
    const ids = [...byPostId.keys()];
    if (!ids.length) return { ok: true, refreshed: 0, scanned: 0, backfilled };

    const BROWSER_UA =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
    const scores = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 100) {
      const slice = ids.slice(i, i + 100);
      const fullnames = slice.map((id) => `t3_${id}`).join(",");
      const url = `https://api.reddit.com/api/info.json?id=${fullnames}&raw_json=1`;
      try {
        const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } });
        if (!res.ok) continue;
        const json: any = await res.json().catch(() => null);
        for (const c of json?.data?.children ?? []) {
          const d = c?.data;
          if (d?.id && typeof d.score === "number") scores.set(d.id, d.score);
        }
      } catch { /* skip batch */ }
      await new Promise((r) => setTimeout(r, 250));
    }

    let refreshed = 0;
    for (const [postId, score] of scores) {
      const rowId = byPostId.get(postId);
      if (!rowId) continue;
      const { error: upErr } = await supabaseAdmin
        .from("reddit_imports")
        .update({ current_score: score } as never)
        .eq("id", rowId);
      if (!upErr) refreshed++;
    }
    return { ok: true, refreshed, scanned: ids.length, backfilled };
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

