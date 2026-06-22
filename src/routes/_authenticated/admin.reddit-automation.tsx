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
} from "@/lib/reddit-automation.functions";

export const Route = createFileRoute("/_authenticated/admin/reddit-automation")({
  head: () => ({ meta: [{ title: "Reddit Automation — WKNA 49 Admin" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ["reddit-automation-settings"], queryFn: () => getRedditAutomationSettings() });
  const notifsQ = useQuery({ queryKey: ["reddit-notifications"], queryFn: () => listRedditNotifications({ data: {} }) });

  const s: any = settingsQ.data ?? {};

  const [mode, setMode] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [template, setTemplate] = useState<string>("");
  const [perHour, setPerHour] = useState<number | "">("");
  const [perDay, setPerDay] = useState<number | "">("");

  const eff = {
    mode: mode || s.mode || "off",
    enabled: enabled ?? s.enabled ?? false,
    username: username || s.reddit_username || "",
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
          reddit_username: eff.username,
          reddit_password: password || undefined,
          template_markdown: eff.template,
          rate_per_hour: eff.perHour,
          rate_per_day: eff.perDay,
        },
      }),
    onSuccess: () => {
      toast.success("Settings saved");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["reddit-automation-settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const capture = useMutation({
    mutationFn: () => captureRedditSession({ data: {} as any }),
    onSuccess: () => toast.success("Session capture dispatched to GitHub Actions"),
    onError: (e: any) => toast.error(e?.message ?? "Dispatch failed"),
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
          <h2 className="font-display text-lg font-bold text-primary">Reddit account</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Session: {sessionBadge}</span>
            <button
              onClick={() => capture.mutate()}
              disabled={capture.isPending}
              className="rounded-md border px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
            >
              {capture.isPending ? "Dispatching…" : "Capture session now"}
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Credentials are AES-256-GCM encrypted at rest. The password is never returned to the browser after saving.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="block font-medium">Username</span>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={eff.username}
              placeholder="WKNA49"
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="block font-medium">Password</span>
            <input
              type="password"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={password}
              placeholder={s.has_password ? "•••••••• (saved)" : ""}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>
        {s.session_last_error && (
          <p className="mt-2 text-xs text-red-700">Last error: {s.session_last_error}</p>
        )}
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
        <h2 className="font-display text-lg font-bold text-primary">Notification queue</h2>
        <p className="mt-1 text-sm text-muted-foreground">Recent 50 notifications.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Article</th>
                <th className="py-2 pr-3">Subreddit</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Attempts</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(notifsQ.data ?? []).map((n: any) => (
                <tr key={n.id} className="border-b align-top">
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    {n.posts?.slug ? (
                      <Link to="/news/$slug" params={{ slug: n.posts.slug }} className="font-medium hover:underline">{n.posts?.title ?? "(post)"}</Link>
                    ) : (
                      <span>{n.posts?.title ?? "—"}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs">{n.subreddit ? `r/${n.subreddit}` : "—"}</td>
                  <td className="py-2 pr-3"><StatusPill status={n.status} mode={n.mode_at_enqueue} /></td>
                  <td className="py-2 pr-3 text-xs">{n.attempt_count}</td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-2">
                      {(n.status === "awaiting_approval" || n.status === "queued") && (
                        <button onClick={() => approve.mutate(n.id)} className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs font-semibold text-green-800">Approve & post</button>
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
                <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No notifications yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-amber-50 p-4 text-xs text-amber-900">
        <p className="font-semibold">Setup checklist</p>
        <ol className="ml-5 mt-2 list-decimal space-y-1">
          <li>Save Reddit username + password above.</li>
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
