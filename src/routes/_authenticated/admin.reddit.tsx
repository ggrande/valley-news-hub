import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/reddit")({
  component: RedditIntake,
});

type Mode = "url" | "manual";

function RedditIntake() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [manual, setManual] = useState({ url: "", subreddit: "", title: "", body: "", comments: "" });

  const list = useQuery({
    queryKey: ["reddit-imports"],
    queryFn: async () => (await supabase.from("reddit_imports").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
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
    return imp.id;
  };

  const submitUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
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
        import_status: "parsed",
      }, data.comments ?? []);
      setUrl("");
    } catch (e) {
      setErr((e as Error).message + " — try manual paste mode.");
    } finally { setBusy(false); }
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
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
        import_status: "parsed",
      }, parsed);
      setManual({ url: "", subreddit: "", title: "", body: "", comments: "" });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-black text-primary">Reddit Intake</h1>
        <p className="text-sm text-muted-foreground">Pull source material from Reddit posts to draft a local-news article. Source material is admin-only and never appears on the public site.</p>
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
          <thead className="bg-[color:var(--ivory)] text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Title</th><th className="p-3">Subreddit</th><th className="p-3">Status</th><th className="p-3">Created</th></tr></thead>
          <tbody>
            {list.data?.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-3"><Link to="/admin/reddit/$id" params={{ id: r.id }} className="font-semibold text-primary hover:underline">{r.original_title ?? "(untitled)"}</Link></td>
                <td className="p-3 text-muted-foreground">r/{r.subreddit ?? "—"}</td>
                <td className="p-3"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{r.import_status}</span></td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {list.data?.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No intakes yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
