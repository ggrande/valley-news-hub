import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { drainRedditIntake, getRedditQueueStats, regenerateImport } from "@/lib/generate-article.functions";

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
        {err && <p className="mt-3 text-sm text-[color:var(--breaking)]">{err}</p>}
      </div>

      <div className="rounded-lg border bg-white">
        <h2 className="border-b p-4 font-display text-lg font-bold text-primary">Recent intakes</h2>
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--ivory)] text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Title</th><th className="p-3">Subreddit</th><th className="p-3">Status</th><th className="p-3">Created</th><th className="p-3">Action</th></tr></thead>
          <tbody>
            {list.data?.map((r: any) => {
              const orphan = r.import_status === "generated" && r.generated_post_id && !liveSet.has(r.generated_post_id);
              const canRegen = r.import_status === "discarded" || r.import_status === "error" || orphan;
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-3"><Link to="/admin/reddit/$id" params={{ id: r.id }} className="font-semibold text-primary hover:underline">{r.original_title ?? "(untitled)"}</Link></td>
                  <td className="p-3 text-muted-foreground">r/{r.subreddit ?? "—"}</td>
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
