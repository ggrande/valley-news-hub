import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { drainRedditIntake, getRedditQueueStats, regenerateImport, runRedditAutomationNow } from "@/lib/generate-article.functions";
import { listRedditListingJobs, getRedditSessionStatus } from "@/lib/reddit-listing.functions";

export const Route = createFileRoute("/_authenticated/admin/reddit")({
  component: RedditIntake,
});

type Mode = "url" | "manual";

function RedditIntake() {
  const drain = useServerFn(drainRedditIntake);
  const getStats = useServerFn(getRedditQueueStats);
  const regenerate = useServerFn(regenerateImport);
  const [regenBusy, setRegenBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [queueBusy, setQueueBusy] = useState<"next" | "all" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [queueMsg, setQueueMsg] = useState("");
  const [manual, setManual] = useState({ url: "", subreddit: "", title: "", body: "", comments: "" });
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const queueAbort = useRef(false);

  const uploadHero = async (): Promise<string | null> => {
    if (!heroFile) return null;
    const ext = (heroFile.name.split(".").pop() || "jpg").toLowerCase();
    const path = `intake/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("news-media").upload(path, heroFile, {
      contentType: heroFile.type || "image/jpeg",
      upsert: false,
    });
    if (error) throw error;
    return `/api/media?p=${encodeURIComponent(path)}`;
  };

  const list = useQuery({
    queryKey: ["reddit-imports"],
    queryFn: async () => (await supabase.from("reddit_imports").select("*").order("original_created_at", { ascending: false, nullsFirst: false }).limit(100)).data ?? [],
  });

  const linkedPostIds = (list.data ?? []).map((r: any) => r.generated_post_id).filter(Boolean);
  const livePosts = useQuery({
    queryKey: ["reddit-linked-posts", linkedPostIds.sort().join(",")],
    enabled: linkedPostIds.length > 0,
    queryFn: async () => (await supabase.from("posts").select("id").in("id", linkedPostIds)).data ?? [],
  });
  const liveSet = new Set((livePosts.data ?? []).map((p: any) => p.id));

  const stats = useQuery({
    queryKey: ["reddit-queue-stats"],
    queryFn: async () => getStats(),
  });

  const createImport = async (payload: any, comments: any[]) => {
    const { data: imp, error } = await supabase.from("reddit_imports").insert(payload).select("id").single();
    if (error) throw error;
    if (comments.length) {
      const rows = comments.map((c: any, i: number) => ({
        reddit_import_id: imp.id,
        source_comment_id: c.id ?? null,
        parent_source_comment_id: c.parent_id ?? null,
        display_name: c.author ?? c.display_name ?? "redditor",
        body: c.body,
        score: c.score ?? null,
        source_created_at: c.created_utc ? new Date(c.created_utc * 1000).toISOString() : null,
        nesting_level: c.depth ?? c.nesting_level ?? 0,
      }));
      await supabase.from("reddit_import_comments").insert(rows);
    }
    list.refetch();
    stats.refetch();
    return imp.id;
  };

  const refreshQueue = async () => {
    await Promise.all([list.refetch(), stats.refetch()]);
  };

  const generateNext = async () => {
    setQueueBusy("next");
    setErr(null);
    setQueueMsg("Generating next 10 newest intakes...");
    try {
      const r: any = await drain({ data: { limit: 10 } });
      setQueueMsg(`Processed ${r.processed}${r.discarded ? `, auto-discarded ${r.discarded} removed/deleted` : ""}. ${r.remaining} pending.`);
      await refreshQueue();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setQueueBusy(null);
    }
  };

  const generateAll = async () => {
    if (queueBusy === "all") {
      queueAbort.current = true;
      setQueueMsg("Stopping queue after the current 10 finish...");
      return;
    }
    queueAbort.current = false;
    setQueueBusy("all");
    setErr(null);
    let totalProcessed = 0;
    let totalDiscarded = 0;
    try {
      while (!queueAbort.current) {
        const r: any = await drain({ data: { limit: 10 } });
        totalProcessed += r.processed;
        totalDiscarded += r.discarded ?? 0;
        setQueueMsg(`Queue: ${totalProcessed} generated, ${totalDiscarded} discarded, ${r.remaining} pending...`);
        await refreshQueue();
        if (r.processed === 0 || r.remaining === 0) break;
      }
      setQueueMsg(`Queue done. ${totalProcessed} generated, ${totalDiscarded} discarded.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setQueueBusy(null);
      queueAbort.current = false;
    }
  };

  const submitUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const heroUrl = await uploadHero();
      const { data, error } = await supabase.functions.invoke("reddit-fetch", { body: { url } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await createImport({
        source_url: data.post.permalink,
        subreddit: data.post.subreddit,
        reddit_post_id: data.post.reddit_post_id,
        original_title: data.post.title,
        original_body: data.post.body,
        original_author_display: data.post.author,
        original_created_at: data.post.created_utc ? new Date(data.post.created_utc * 1000).toISOString() : null,
        source_score: data.post.score,
        candidate_hero_image_url: heroUrl,
        import_status: "parsed",
      }, data.comments ?? []);
      setUrl("");
      setHeroFile(null);
    } catch (e) {
      setErr((e as Error).message + " — try manual paste mode.");
    } finally { setBusy(false); }
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const heroUrl = await uploadHero();
      const parsed = manual.comments.split(/\n+/).filter(Boolean).map((line, i) => {
        const m = line.match(/^([^:]+):\s*(.*)$/);
        return { id: `m${i}`, author: m?.[1]?.trim() ?? "redditor", body: m?.[2]?.trim() ?? line.trim(), depth: 0 };
      });
      await createImport({
        source_url: manual.url || null,
        subreddit: manual.subreddit || null,
        original_title: manual.title,
        original_body: manual.body,
        raw_comment_text: manual.comments,
        parsed_comments: parsed,
        candidate_hero_image_url: heroUrl,
        import_status: "parsed",
      }, parsed);
      setManual({ url: "", subreddit: "", title: "", body: "", comments: "" });
      setHeroFile(null);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-black text-primary">Reddit Intake</h1>
        <p className="text-sm text-muted-foreground">Pull source material from Reddit posts to draft a local-news article. Source material is admin-only and never appears on the public site.</p>
      </div>

      <AutomationPanel />






      <div className="rounded-lg border bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-primary">Generation queue</h2>
            <p className="text-sm text-muted-foreground">Works newest to oldest in batches of 10 and skips removed/deleted posts.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={generateNext}
              disabled={!!queueBusy || (stats.data?.pending ?? 0) === 0}
              className="h-10 rounded-md border border-primary px-4 text-sm font-semibold text-primary disabled:opacity-50"
            >
              {queueBusy === "next" ? "Working..." : `Generate next 10 (${stats.data?.pending ?? 0} pending)`}
            </button>
            <button
              onClick={generateAll}
              disabled={queueBusy === "next" || ((stats.data?.pending ?? 0) === 0 && queueBusy !== "all")}
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {queueBusy === "all" ? "Stop queue" : `Generate all (${stats.data?.pending ?? 0})`}
            </button>
          </div>
        </div>
        {queueMsg && <p className="mt-3 text-sm text-muted-foreground">{queueMsg}</p>}
      </div>

      <div className="rounded-lg border bg-white p-6">
        <div className="mb-4 flex gap-2 text-xs font-semibold uppercase">
          <button onClick={() => setMode("url")} className={`rounded border px-3 py-2 ${mode === "url" ? "bg-primary text-primary-foreground" : ""}`}>URL Import</button>
          <button onClick={() => setMode("manual")} className={`rounded border px-3 py-2 ${mode === "manual" ? "bg-primary text-primary-foreground" : ""}`}>Manual Paste</button>
        </div>
        {mode === "url" ? (
          <form onSubmit={submitUrl} className="flex flex-col gap-3 sm:flex-row">
            <input value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://www.reddit.com/r/WestVirginia/comments/..." className="h-10 flex-1 rounded border px-3 text-sm" />
            <button disabled={busy} className="h-10 rounded bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Fetching…" : "Fetch & Save"}</button>
          </form>
        ) : (
          <form onSubmit={submitManual} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={manual.url} onChange={(e) => setManual({ ...manual, url: e.target.value })} placeholder="Reddit URL (optional)" className="h-10 rounded border px-3 text-sm" />
              <input value={manual.subreddit} onChange={(e) => setManual({ ...manual, subreddit: e.target.value })} placeholder="Subreddit" className="h-10 rounded border px-3 text-sm" />
            </div>
            <input value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} required placeholder="Post title" className="h-10 w-full rounded border px-3 text-sm" />
            <textarea value={manual.body} onChange={(e) => setManual({ ...manual, body: e.target.value })} rows={5} placeholder="Post body" className="w-full rounded border px-3 py-2 text-sm" />
            <textarea value={manual.comments} onChange={(e) => setManual({ ...manual, comments: e.target.value })} rows={8} placeholder="Comments — one per line, format: username: text" className="w-full rounded border px-3 py-2 text-sm" />
            <button disabled={busy} className="h-10 rounded bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Saving…" : "Save Intake"}</button>
          </form>
        )}
        <div className="mt-4 rounded border border-dashed bg-slate-50 p-3">
          <label className="text-xs font-semibold uppercase text-muted-foreground">Candidate hero image (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setHeroFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm"
          />
          {heroFile && <p className="mt-1 text-xs text-muted-foreground">{heroFile.name} — {(heroFile.size / 1024).toFixed(0)} KB. The AI will judge whether to use it as the hero.</p>}
        </div>
        {err && <p className="mt-3 text-sm text-[color:var(--breaking)]">{err}</p>}
      </div>

      <div className="rounded-lg border bg-white">
        <h2 className="border-b p-4 font-display text-lg font-bold text-primary">Recent intakes</h2>
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--ivory)] text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Title</th><th className="p-3">Subreddit</th><th className="p-3">Score</th><th className="p-3">Status</th><th className="p-3">Created</th><th className="p-3">Action</th></tr></thead>
          <tbody>
            {list.data?.map((r: any) => {
              const orphan = r.import_status === "generated" && r.generated_post_id && !liveSet.has(r.generated_post_id);
              const canRegen = r.import_status === "discarded" || r.import_status === "error" || orphan;
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-3"><Link to="/admin/reddit/$id" params={{ id: r.id }} className="font-semibold text-primary hover:underline">{r.original_title ?? "(untitled)"}</Link></td>
                  <td className="p-3 text-muted-foreground">
                    {r.source_url ? (
                      <a href={r.source_url} target="_blank" rel="noreferrer" className="hover:underline">r/{r.subreddit ?? "—"}</a>
                    ) : (
                      <>r/{r.subreddit ?? "—"}</>
                    )}
                  </td>
                  <td className="p-3 text-xs tabular-nums">
                    {typeof r.current_score === "number" ? (
                      <span title="Live upvote count">{r.current_score.toLocaleString()}</span>
                    ) : typeof r.source_score === "number" ? (
                      <span className="text-muted-foreground" title="Score at import time (live unavailable)">{r.source_score.toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{orphan ? "post deleted" : r.import_status}</span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    {canRegen && (
                      <button
                        disabled={regenBusy === r.id}
                        onClick={async () => {
                          setRegenBusy(r.id);
                          setErr(null);
                          try {
                            await regenerate({ data: { importId: r.id } });
                            await refreshQueue();
                            await livePosts.refetch();
                          } catch (e) { setErr((e as Error).message); }
                          finally { setRegenBusy(null); }
                        }}
                        className="rounded border border-primary px-2 py-1 text-xs font-semibold text-primary disabled:opacity-50"
                      >
                        {regenBusy === r.id ? "Regenerating…" : "Regenerate"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {list.data?.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No intakes yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const AUTOMATION_KEYS = [
  { key: "automation_enabled", label: "Enable automation (runs every 6 hours)", type: "bool", default: false },
  { key: "automation_subreddits", label: "Subreddits to monitor (comma-separated, e.g. WestVirginia, Charleston)", type: "text", default: "WestVirginia, Charleston" },
  { key: "automation_posts_per_sub", label: "Posts to pull per subreddit per run", type: "number", default: 10 },
  { key: "automation_sort_by", label: "Prioritize which posts to pull", type: "select", default: "new", options: [
    { value: "new", label: "Newest first" },
    { value: "hot", label: "Hot (trending now)" },
    { value: "top", label: "Top (most upvoted)" },
    { value: "rising", label: "Rising (gaining momentum)" },
    { value: "best", label: "Best (Reddit's blended ranking)" },
  ] },
  { key: "automation_top_window", label: "Time window (only used for Top)", type: "select", default: "day", options: [
    { value: "hour", label: "Past hour" },
    { value: "day", label: "Past 24 hours" },
    { value: "week", label: "Past week" },
    { value: "month", label: "Past month" },
    { value: "year", label: "Past year" },
    { value: "all", label: "All time" },
  ] },
  { key: "automation_min_score", label: "Minimum upvote score (skip below)", type: "number", default: 0 },
  { key: "automation_moderation_hold_hours", label: "Moderation hold (hours before a post is eligible — set to 0 for high-volume subreddits)", type: "number", default: 3 },
  { key: "automation_use_session_cookies", label: "Use logged-in Reddit session (routes the fetch through GitHub Actions with WKNA49 cookies — required for IP-blocked subs)", type: "bool", default: false },

  { key: "automation_auto_generate", label: "Auto-generate article drafts from imports", type: "bool", default: false },
  { key: "automation_generate_limit", label: "Max drafts to generate per run", type: "number", default: 20 },
  { key: "automation_auto_filler_image", label: "Auto-generate AI hero image when none was provided (only for drafts that pass moderation)", type: "bool", default: false },
  { key: "automation_auto_publish", label: "Auto-publish drafts that pass moderation", type: "bool", default: false },

] as const;

function nextCronFire(): Date {
  // Cron runs at minute 0 of every 6th UTC hour: 00, 06, 12, 18.
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
    Math.floor(now.getUTCHours() / 6) * 6 + 6, 0, 0, 0,
  ));
  return next;
}

function formatCountdown(target: Date, now: Date): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "any moment";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function AutomationPanel() {
  const runNow = useServerFn(runRedditAutomationNow);
  const listJobs = useServerFn(listRedditListingJobs);
  const getSessionStatus = useServerFn(getRedditSessionStatus);
  const q = useQuery({
    queryKey: ["automation-settings"],
    queryFn: async () => (await supabase.from("site_settings").select("*").like("key", "automation_%")).data ?? [],
  });

  const [vals, setVals] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const nextFire = nextCronFire();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!q.data) return;
    const map: Record<string, any> = {};
    for (const r of q.data as any[]) map[r.key] = r.value;
    setVals(map);
  }, [q.data]);

  const save = async (key: string, value: any) => {
    setVals((v) => ({ ...v, [key]: value }));
    setSaving(key);
    try { await supabase.from("site_settings").upsert({ key, value }); }
    finally { setSaving(null); }
  };

  const enabled = vals.automation_enabled === true;
  const useSessionCookies = vals.automation_use_session_cookies === true;

  const sessionStatus = useQuery({
    queryKey: ["reddit-session-status"],
    queryFn: async () => getSessionStatus(),
    refetchInterval: 15000,
    enabled: useSessionCookies,
  });
  const jobs = useQuery({
    queryKey: ["reddit-listing-jobs"],
    queryFn: async () => listJobs({ data: { limit: 8 } }),
    refetchInterval: 5000,
    enabled: useSessionCookies,
  });
  const s = sessionStatus.data;

  const triggerNow = async () => {
    setRunBusy(true); setRunErr(null); setRunMsg("Running automation…");
    try {
      const r: any = await runNow();
      if (r?.skipped) {
        setRunMsg(`Skipped: ${r.reason ?? "disabled"}. Enable automation above to run.`);
      } else {
        const parts: string[] = [];
        if (typeof r?.dispatched_jobs === "number" && r.dispatched_jobs > 0) parts.push(`dispatched ${r.dispatched_jobs} session jobs`);
        if (typeof r?.imported === "number") parts.push(`imported ${r.imported}`);
        if (typeof r?.generated === "number") parts.push(`generated ${r.generated}`);
        if (typeof r?.published === "number") parts.push(`published ${r.published}`);
        if (typeof r?.filler_images === "number") parts.push(`${r.filler_images} filler images`);
        if (typeof r?.skipped_existing === "number") parts.push(`${r.skipped_existing} already known`);
        if (typeof r?.skipped_moderation_hold === "number" && r.skipped_moderation_hold > 0) parts.push(`${r.skipped_moderation_hold} waiting for moderation hold`);
        if (typeof r?.skipped_low_score === "number" && r.skipped_low_score > 0) parts.push(`${r.skipped_low_score} below min score`);
        if (r?.errors?.length) parts.push(`${r.errors.length} errors`);
        setRunMsg(`Done — ${parts.join(", ") || "no changes"}.`);
        if (r?.errors?.length) {
          console.warn("[automation] errors:", r.errors);
          setRunErr(r.errors.slice(0, 3).join(" | "));
        }
      }
    } catch (e) {
      setRunErr((e as Error).message);
      setRunMsg(null);
    } finally {
      setRunBusy(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-primary">Scheduled automation</h2>
          <p className="text-sm text-muted-foreground">Every 6 hours: import newest posts from your watched subreddits, optionally draft articles, generate hero images, and publish.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${enabled ? "bg-green-100 text-green-800" : "bg-slate-100 text-muted-foreground"}`}>
          {enabled ? "ON" : "OFF"}
        </span>
      </div>
      <div className="mb-4 flex flex-col gap-3 rounded-md border bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <div className="font-semibold text-primary">
            Next scheduled run in {formatCountdown(nextFire, now)}
          </div>
          <div className="text-xs text-muted-foreground">
            {nextFire.toLocaleString()} (runs at 00:00, 06:00, 12:00, 18:00 UTC)
          </div>
          {runMsg && <div className="mt-1 text-xs text-muted-foreground">{runMsg}</div>}
          {runErr && <div className="mt-1 text-xs text-[color:var(--breaking)]">{runErr}</div>}
        </div>
        <button
          onClick={triggerNow}
          disabled={runBusy}
          className="h-10 shrink-0 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {runBusy ? "Running…" : "Run automation now"}
        </button>
      </div>

      <div className="space-y-3">
        {AUTOMATION_KEYS.map((k) => {
          const v = vals[k.key] ?? k.default;
          if (k.type === "bool") return (
            <label key={k.key} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
              <span className="text-sm font-semibold">{k.label}</span>
              <input
                type="checkbox"
                checked={!!v}
                onChange={(e) => save(k.key, e.target.checked)}
                className="h-5 w-5"
              />
            </label>
          );
          if (k.type === "number") return (
            <label key={k.key} className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{k.label}</span>
              <input
                type="number"
                value={v ?? ""}
                onChange={(e) => save(k.key, Number(e.target.value))}
                className="h-9 w-24 rounded border px-2 text-sm"
              />
            </label>
          );
          if (k.type === "select") return (
            <label key={k.key} className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{k.label}</span>
              <select
                value={String(v ?? k.default)}
                onChange={(e) => save(k.key, e.target.value)}
                className="h-9 rounded border px-2 text-sm"
              >
                {(k as any).options.map((o: any) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          );
          return (
            <label key={k.key} className="block">
              <span className="text-sm font-semibold">{k.label}</span>
              <input
                value={v ?? ""}
                onChange={(e) => save(k.key, e.target.value)}
                className="mt-1 h-9 w-full rounded border px-3 text-sm"
              />
            </label>
          );
        })}
      </div>
      {saving && <p className="mt-2 text-xs text-muted-foreground">Saving {saving}…</p>}

      {useSessionCookies && (
        <div className="mt-5 rounded-md border bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-primary">Reddit session cookies</div>
              <div className="text-xs text-muted-foreground">
                Automation will dispatch a logged-in GitHub Actions worker per subreddit.
                Manage cookies on the <Link to="/admin/reddit-automation" className="underline">Reddit Automation</Link> page.
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              s?.session_status === "active" ? "bg-green-100 text-green-800"
              : s?.has_session ? "bg-amber-100 text-amber-800"
              : "bg-slate-100 text-muted-foreground"
            }`}>
              {!s?.has_session ? "No session"
                : s.session_status === "active" ? `Active (u/${s.reddit_username ?? "?"})`
                : s.session_status === "expired" ? "Expired — recapture"
                : s.session_status ?? "unknown"}
            </span>
          </div>
          {s?.session_last_error && (
            <p className="mt-2 text-xs text-[color:var(--breaking)]">Last session error: {s.session_last_error}</p>
          )}
          {(jobs.data?.length ?? 0) > 0 && (
            <div className="mt-3 overflow-hidden rounded border bg-white">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left uppercase text-muted-foreground">
                  <tr><th className="p-2">Sub / Sort</th><th className="p-2">Status</th><th className="p-2">Posts</th><th className="p-2">Imported</th><th className="p-2">When</th></tr>
                </thead>
                <tbody>
                  {(jobs.data ?? []).map((j: any) => (
                    <tr key={j.id} className="border-t">
                      <td className="p-2">r/{j.subreddit} · {j.sort}{j.top_window ? `/${j.top_window}` : ""}</td>
                      <td className="p-2">
                        <span className={`rounded px-2 py-0.5 ${j.status === "succeeded" ? "bg-green-100 text-green-800" : j.status === "failed" ? "bg-red-100 text-red-800" : "bg-slate-100"}`}>{j.status}</span>
                      </td>
                      <td className="p-2 tabular-nums">{j.posts_count ?? "—"}</td>
                      <td className="p-2 tabular-nums">{j.imported_count ?? "—"}</td>
                      <td className="p-2 text-muted-foreground" title={j.error ?? ""}>{new Date(j.created_at).toLocaleTimeString()}{j.error ? " · error" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

