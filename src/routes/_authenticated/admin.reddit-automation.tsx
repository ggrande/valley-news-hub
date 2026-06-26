import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  getRedditAutomationSettings,
  updateRedditAutomationSettings,
  listRedditNotifications,
  approveRedditNotification,
  skipRedditNotification,
  retryRedditNotification,
  captureRedditSession,
  debugGitHubStatus,
  setRedditSessionCookies,
  refreshNotificationQueue,
} from "@/lib/reddit-automation.functions";

export const Route = createFileRoute("/_authenticated/admin/reddit-automation")({
  head: () => ({ meta: [{ title: "Reddit Automation — WKNA 49 Admin" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ["reddit-automation-settings"], queryFn: () => getRedditAutomationSettings() });

  // Notification filters
  const [windowHours, setWindowHours] = useState<number | null>(24);
  const [minUpvotes, setMinUpvotes] = useState<number | "">("");
  const [sortBy, setSortBy] = useState<"created_at" | "upvotes">("created_at");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const notifsQ = useQuery({
    queryKey: ["reddit-notifications", windowHours, minUpvotes, sortBy, statusFilter],
    queryFn: () => listRedditNotifications({ data: {
      windowHours,
      minUpvotes: typeof minUpvotes === "number" ? minUpvotes : null,
      sortBy,
      status: statusFilter || undefined,
      limit: 100,
    } }),
    refetchInterval: 30_000,
  });

  const s: any = settingsQ.data ?? {};

  const [mode, setMode] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [template, setTemplate] = useState<string>("");
  const [perHour, setPerHour] = useState<number | "">("");
  const [perDay, setPerDay] = useState<number | "">("");

  const eff = {
    mode: mode || s.mode || "off",
    enabled: enabled ?? s.enabled ?? false,
    template: template || s.template_markdown || "",
    perHour: perHour === "" ? (s.rate_per_hour ?? 4) : Number(perHour),
    perDay: perDay === "" ? (s.rate_per_day ?? 20) : Number(perDay),
  };

  const save = useMutation({
    mutationFn: () =>
      updateRedditAutomationSettings({
        data: {
          mode: eff.mode as any,
          enabled: eff.enabled,
          template_markdown: eff.template,
          rate_per_hour: eff.perHour,
          rate_per_day: eff.perDay,
        },
      }),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["reddit-automation-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const capture = useMutation({
    mutationFn: () => captureRedditSession({ data: {} as any }),
    onSuccess: () => toast.success("Session capture dispatched to GitHub Actions"),
    onError: (e: any) => toast.error(e?.message ?? "Dispatch failed"),
  });

  const [diag, setDiag] = useState<any>(null);
  const diagnose = useMutation({
    mutationFn: () => debugGitHubStatus({ data: {} as any }),
    onSuccess: (d) => { setDiag(d); toast.success("Diagnostics loaded"); },
    onError: (e: any) => toast.error(e?.message ?? "Diagnostics failed"),
  });

  const [cookieRaw, setCookieRaw] = useState<string>("");
  const pasteCookies = useMutation({
    mutationFn: () => setRedditSessionCookies({ data: { raw: cookieRaw } }),
    onSuccess: (r: any) => {
      toast.success(`Saved ${r.count} cookies`);
      setCookieRaw("");
      qc.invalidateQueries({ queryKey: ["reddit-automation-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save cookies"),
  });

  const approve = useMutation({
    mutationFn: (id: string) => approveRedditNotification({ data: { id } }),
    onSuccess: () => { toast.success("Approved & dispatched"); qc.invalidateQueries({ queryKey: ["reddit-notifications"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Approve failed"),
  });
  const skip = useMutation({
    mutationFn: (id: string) => skipRedditNotification({ data: { id } }),
    onSuccess: () => { toast.success("Skipped"); qc.invalidateQueries({ queryKey: ["reddit-notifications"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Skip failed"),
  });
  const retry = useMutation({
    mutationFn: (id: string) => retryRedditNotification({ data: { id } }),
    onSuccess: () => { toast.success("Retry dispatched"); qc.invalidateQueries({ queryKey: ["reddit-notifications"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Retry failed"),
  });

  const refreshQueue = useMutation({
    mutationFn: () => refreshNotificationQueue({ data: { windowHours } }),
    onSuccess: (r: any) => {
      const parts = [
        `${r?.backfilled ?? 0} backfilled`,
        `${r?.refreshed ?? 0} upvote${r?.refreshed === 1 ? "" : "s"} refreshed`,
      ];
      toast.success(parts.join(" · "));

      qc.invalidateQueries({ queryKey: ["reddit-notifications"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Refresh failed"),
  });

  const sessionBadge = (() => {
    switch (s.session_status) {
      case "active": return <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Active</span>;
      case "expired": return <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Expired</span>;
      case "challenge_required": return <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">Challenge required</span>;
      case "error": return <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Error</span>;
      default: return <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">None</span>;
    }
  })();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-black text-primary">Reddit Comment Automation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          When an article sourced from Reddit is published, optionally post a notification comment on the original thread from u/WKNA49.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-6">
        <h2 className="font-display text-lg font-bold text-primary">Mode</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use dry-run while testing — it logs what would be posted without touching Reddit.</p>
        <div className="mt-3 flex items-center gap-3">
          <select
            className="rounded-md border bg-white px-3 py-2 text-sm"
            value={eff.mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="off">Off — no notifications enqueued</option>
            <option value="dry_run">Dry-run — enqueue + render, never post</option>
            <option value="approval">Approval — wait for an admin to click Approve</option>
            <option value="live">Live — auto-dispatch to GitHub Actions on publish</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={eff.enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Master switch enabled
          </label>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-primary">Reddit session</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Session: {sessionBadge}</span>
            {s.reddit_username && (
              <span className="text-xs text-muted-foreground">as u/{s.reddit_username}</span>
            )}
            <button
              onClick={() => capture.mutate()}
              disabled={capture.isPending}
              className="rounded-md border px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
              title="Re-runs the worker to refresh session state using the saved cookies."
            >
              {capture.isPending ? "Dispatching…" : "Refresh session"}
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Authentication is handled via the pasted cookies below — no Reddit username or password is stored.
        </p>
        {s.session_last_error && (
          <p className="mt-2 text-xs text-red-700">Last error: {s.session_last_error}</p>
        )}
      </section>


      <section className="rounded-lg border bg-white p-6">
        <h2 className="font-display text-lg font-bold text-primary">Paste session cookies</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fastest path past Reddit's bot detection: log in as <code>u/WKNA49</code> in your own browser, export the cookies, and paste them here. The worker will reuse them and skip the headless login entirely.
        </p>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-semibold">How to export cookies</summary>
          <ol className="ml-5 mt-2 list-decimal space-y-1 text-muted-foreground">
            <li>Install the <a className="underline" href="https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm" target="_blank" rel="noreferrer">Cookie-Editor</a> extension (Chrome/Firefox/Edge).</li>
            <li>Go to <code>https://www.reddit.com</code> and make sure you're logged in as u/WKNA49.</li>
            <li>Click the Cookie-Editor icon → <strong>Export</strong> → <strong>Export as JSON</strong> (copies to clipboard).</li>
            <li>Paste below and click <strong>Save cookies</strong>.</li>
          </ol>
          <p className="mt-2 text-muted-foreground">Also accepted: a raw <code>Cookie:</code> header string copied from DevTools → Network.</p>
        </details>
        <textarea
          id="reddit-cookie-input"
          className="mt-3 h-40 w-full rounded-md border p-3 font-mono text-xs"
          placeholder='[{"name":"reddit_session","value":"...","domain":".reddit.com",...}, ...]'
          value={cookieRaw}
          onChange={(e) => setCookieRaw(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <button
            id="reddit-cookie-save"
            onClick={() => pasteCookies.mutate()}
            disabled={pasteCookies.isPending || !cookieRaw.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pasteCookies.isPending ? "Saving…" : "Save cookies"}
          </button>
        </div>

        <div className="mt-4 rounded-md border border-dashed bg-amber-50 p-3 text-xs">
          <div className="font-semibold text-amber-900">⚡ One-click bookmarklet</div>
          <p className="mt-1 text-amber-900">
            After copying cookies from Cookie-Editor (Export → JSON), come back to this page and click the bookmarklet — it pastes from your clipboard and submits automatically.
          </p>
          <p className="mt-2 text-amber-900">
            <strong>Install:</strong> drag this link to your bookmarks bar →{" "}
            <a
              className="inline-block rounded bg-primary px-3 py-1 font-semibold text-primary-foreground no-underline"
              href={`javascript:(async()=>{try{if(!/admin\\/reddit-automation/.test(location.pathname)){if(/reddit\\.com$/.test(location.hostname)){const u=document.querySelector('[data-testid=\"user-drawer-button\"],a[href^=\"/user/\"]');alert(u?'✓ Logged into Reddit as '+(u.textContent||'').trim()+'.\\n\\nNow:\\n1) Open Cookie-Editor → Export → JSON\\n2) Go to the WKNA admin page\\n3) Click this bookmarklet again':'⚠ Not logged into reddit.com. Log in as u/WKNA49 first.');return;}alert('Open this on the WKNA admin → Reddit Automation page (or on reddit.com to check login).');return;}const t=(await navigator.clipboard.readText()||'').trim();if(!t){alert('Clipboard is empty. Copy cookies from Cookie-Editor first.');return;}const ta=document.getElementById('reddit-cookie-input');if(!ta){alert('Cookie textarea not found.');return;}const setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;setter.call(ta,t);ta.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,150));const btn=document.getElementById('reddit-cookie-save');if(!btn){alert('Save button not found.');return;}btn.click();}catch(e){alert('Bookmarklet error: '+(e&&e.message||e));}})();`}
              onClick={(e) => { e.preventDefault(); toast.info("Drag this button to your bookmarks bar — clicking it here just runs it."); }}
            >
              📎 WKNA Paste Reddit Cookies
            </a>
          </p>
          <p className="mt-2 text-amber-900">
            Run it on <code>reddit.com</code> to verify you're logged in as <code>u/WKNA49</code>, or on this admin page to paste &amp; save in one click.
          </p>
          <p className="mt-1 text-amber-800">
            Note: a pure reddit.com bookmarklet can't read the <code>reddit_session</code> cookie directly — it's <code>httpOnly</code>. Cookie-Editor (extension) is the only way to export it, which is why this bookmarklet handles the paste/submit step instead.
          </p>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-6">
        <h2 className="font-display text-lg font-bold text-primary">Comment template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Variables: <code className="rounded bg-gray-100 px-1">{`{{article_title}}`}</code>,{" "}
          <code className="rounded bg-gray-100 px-1">{`{{article_url}}`}</code>,{" "}
          <code className="rounded bg-gray-100 px-1">{`{{article_dek}}`}</code>,{" "}
          <code className="rounded bg-gray-100 px-1">{`{{subreddit}}`}</code>,{" "}
          <code className="rounded bg-gray-100 px-1">{`{{reddit_thread_url}}`}</code>.
        </p>
        <textarea
          className="mt-2 h-48 w-full rounded-md border p-3 font-mono text-sm"
          value={eff.template}
          onChange={(e) => setTemplate(e.target.value)}
        />
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Preview with sample data</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs">
{eff.template
  .replace(/\{\{\s*article_title\s*\}\}/g, "Charleston city council approves road bond")
  .replace(/\{\{\s*article_url\s*\}\}/g, "https://wkna49.com/news/charleston-road-bond")
  .replace(/\{\{\s*article_dek\s*\}\}/g, "Council unanimously approved a $42M bond for the I-77 corridor.")
  .replace(/\{\{\s*subreddit\s*\}\}/g, "Charleston")
  .replace(/\{\{\s*reddit_thread_url\s*\}\}/g, "https://www.reddit.com/r/Charleston/comments/abc123/")}
          </pre>
        </details>
      </section>

      <section className="rounded-lg border bg-white p-6">
        <h2 className="font-display text-lg font-bold text-primary">Rate limits</h2>
        <p className="mt-1 text-sm text-muted-foreground">Enforced at enqueue time. Comments above the cap are skipped.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="block font-medium">Per hour</span>
            <input
              type="number" min={0} max={50}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={eff.perHour}
              onChange={(e) => setPerHour(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            <span className="block font-medium">Per day</span>
            <input
              type="number" min={0} max={500}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={eff.perDay}
              onChange={(e) => setPerDay(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save settings"}
        </button>
      </div>

      <section className="rounded-lg border bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">Notification queue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Synced live with the Posts page and the latest upvote counts from Reddit Intake. Auto-refreshes every 30 s.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2 text-xs">
            <button
              onClick={() => refreshQueue.mutate()}
              disabled={refreshQueue.isPending}
              className="inline-flex h-9 w-9 items-center justify-center self-end rounded-full border bg-white text-muted-foreground hover:text-primary disabled:opacity-50"
              title="Backfill missing notifications and re-pull live upvote counts from Reddit."
              aria-label="Refresh notification queue"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 ${refreshQueue.isPending ? "animate-spin" : ""}`}>
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
            </button>
            <label className="flex flex-col">
              <span className="font-semibold text-muted-foreground">Time window</span>
              <select
                className="mt-1 rounded-md border bg-white px-2 py-1.5"
                value={windowHours === null ? "all" : String(windowHours)}
                onChange={(e) => setWindowHours(e.target.value === "all" ? null : Number(e.target.value))}
              >
                <option value="6">Last 6 hours</option>
                <option value="24">Last 24 hours</option>
                <option value="168">Last 7 days</option>
                <option value="all">All time</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="font-semibold text-muted-foreground">Min upvotes</span>
              <input
                type="number" min={0}
                className="mt-1 w-24 rounded-md border px-2 py-1.5"
                value={minUpvotes}
                placeholder="any"
                onChange={(e) => setMinUpvotes(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col">
              <span className="font-semibold text-muted-foreground">Status</span>
              <select
                className="mt-1 rounded-md border bg-white px-2 py-1.5"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="queued">Queued</option>
                <option value="awaiting_approval">Awaiting approval</option>
                <option value="dispatched">Dispatched</option>
                <option value="posted">Posted</option>
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
                <option value="dry_run_only">Dry run only</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="font-semibold text-muted-foreground">Sort by</span>
              <select
                className="mt-1 rounded-md border bg-white px-2 py-1.5"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="created_at">Newest first</option>
                <option value="upvotes">Upvotes (highest)</option>
              </select>
            </label>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Article</th>
                <th className="py-2 pr-3">Subreddit</th>
                <th className="py-2 pr-3">Upvotes</th>
                <th className="py-2 pr-3">Post</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Attempts</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(notifsQ.data ?? []).map((n: any) => (
                <tr key={n.id} className="border-b align-top">
                  <td className="py-2 pr-3 text-xs text-muted-foreground" title={`Enqueued ${new Date(n.created_at).toLocaleString()}`}>
                    {n.reddit_posted_at ? new Date(n.reddit_posted_at).toLocaleString() : <span className="italic opacity-60">unknown</span>}
                  </td>

                  <td className="py-2 pr-3">
                    {n.posts?.slug ? (
                      <Link to="/news/$slug" params={{ slug: n.posts.slug }} className="font-medium hover:underline">
                        {n.status === "skipped" && <span className="mr-1 text-xs font-bold text-gray-500">[Skipped]</span>}
                        {n.posts?.title ?? "(post)"}
                      </Link>
                    ) : (
                      <span>
                        {n.status === "skipped" && <span className="mr-1 text-xs font-bold text-gray-500">[Skipped]</span>}
                        {n.posts?.title ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {n.reddit_thread_url ? (
                      <a href={n.reddit_thread_url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{n.subreddit ? `r/${n.subreddit}` : "—"}</a>
                    ) : (
                      n.subreddit ? `r/${n.subreddit}` : "—"
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs tabular-nums">
                    {typeof n.upvotes === "number" ? n.upvotes.toLocaleString() : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {n.post_status ? (
                      <span className={`rounded px-2 py-0.5 font-semibold ${n.post_status === "published" ? "bg-emerald-100 text-emerald-800" : n.post_status === "draft" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{n.post_status}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2 pr-3"><StatusPill status={n.status} mode={n.mode_at_enqueue} /></td>
                  <td className="py-2 pr-3 text-xs">{n.attempt_count}</td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-2">
                      {(n.status === "awaiting_approval" || n.status === "queued" || n.status === "skipped") && (
                        <button onClick={() => approve.mutate(n.id)} className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs font-semibold text-green-800">
                          {n.status === "skipped" ? "Approve & post (retry)" : "Approve & post"}
                        </button>
                      )}
                      {n.status !== "posted" && n.status !== "skipped" && (
                        <button onClick={() => skip.mutate(n.id)} className="rounded border px-2 py-1 text-xs font-semibold">Skip</button>
                      )}
                      {n.status === "failed" && (
                        <button onClick={() => retry.mutate(n.id)} className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">Retry</button>
                      )}
                      {n.reddit_comment_permalink && (
                        <a href={n.reddit_comment_permalink} target="_blank" rel="noreferrer" className="rounded border px-2 py-1 text-xs font-semibold">View comment ↗</a>
                      )}
                    </div>
                    {n.failure_reason && <p className="mt-1 text-xs text-red-700">{n.failure_reason}</p>}
                  </td>
                </tr>
              ))}
              {!notifsQ.data?.length && (
                <tr><td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No notifications match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>


      <section className="rounded-lg border bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-primary">GitHub Actions diagnostics</h2>
          <button
            onClick={() => diagnose.mutate()}
            disabled={diagnose.isPending}
            className="rounded-md border px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            {diagnose.isPending ? "Checking…" : "Diagnose GitHub"}
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifies the PAT can reach the repo, lists workflows GitHub sees on the default branch, shows recent runs, and fires a test dispatch.
        </p>
        {diag && (
          <pre className="mt-3 max-h-96 overflow-auto rounded bg-gray-50 p-3 text-xs">
{JSON.stringify(diag, null, 2)}
          </pre>
        )}
      </section>



      <section className="rounded-lg border bg-amber-50 p-4 text-xs text-amber-900">
        <p className="font-semibold">Setup checklist</p>
        <ol className="ml-5 mt-2 list-decimal space-y-1">
          <li>Paste a fresh set of u/WKNA49 cookies into the <strong>Paste session cookies</strong> box above.</li>
          <li>Add the following <strong>repository secrets</strong> to this GitHub repo (Settings → Secrets and variables → Actions):
            <ul className="ml-4 mt-1 list-disc">
              <li><code>APP_BASE_URL</code> — e.g. <code>https://wkna49.com</code></li>
              <li><code>REDDIT_WORKER_WEBHOOK_SECRET</code> — copy from Lovable Cloud secrets</li>
            </ul>
          </li>
          <li>Add a <code>GH_DISPATCH_PAT</code> secret in Lovable Cloud (fine-grained PAT, Actions: write on this repo).</li>
          <li>Add a <code>GITHUB_REPO</code> secret in Lovable Cloud as <code>owner/repo</code>.</li>
          <li>Click <strong>Capture session now</strong> to do the first Reddit login & store cookies.</li>
          <li>Publish a Reddit-sourced article and watch the queue. Stay in <strong>dry-run</strong> or <strong>approval</strong> mode until you've verified the output.</li>
        </ol>
      </section>
    </div>
  );
}

function StatusPill({ status, mode }: { status: string; mode: string }) {
  const map: Record<string, string> = {
    queued: "bg-gray-100 text-gray-800",
    awaiting_approval: "bg-amber-100 text-amber-900",
    dispatched: "bg-blue-100 text-blue-800",
    posted: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    skipped: "bg-gray-100 text-gray-600",
    dry_run_only: "bg-purple-100 text-purple-800",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${map[status] ?? "bg-gray-100"}`}>
      {status.replace(/_/g, " ")}
      {mode === "dry_run" && status !== "dry_run_only" ? " (dry)" : ""}
    </span>
  );
}
