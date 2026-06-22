import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBatch } from "@/lib/import-archive.functions";
import { drainBatch, generateArticleFromImport, publishPost } from "@/lib/generate-article.functions";

export const Route = createFileRoute("/_authenticated/admin/import/$batchId")({
  head: () => ({ meta: [{ title: "Batch — Admin" }, { name: "robots", content: "noindex" }] }),
  component: BatchPage,
});

function BatchPage() {
  const { batchId } = Route.useParams();
  const get = useServerFn(getBatch);
  const drain = useServerFn(drainBatch);
  const genOne = useServerFn(generateArticleFromImport);
  const publish = useServerFn(publishPost);

  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [queueRunning, setQueueRunning] = useState(false);
  const queueAbort = useRef(false);

  async function refresh() {
    try { setData(await get({ data: { id: batchId } })); }
    catch (err: any) { setMsg(`Error: ${err.message}`); }
  }
  useEffect(() => { refresh(); }, [batchId]);

  async function onGen(id: string) {
    setBusy(id); setMsg(`Generating article for ${id.slice(0, 8)}...`);
    try { const r: any = await genOne({ data: { importId: id } }); setMsg(`Draft created. Moderation: ${r.moderationStatus}`); await refresh(); }
    catch (err: any) { setMsg(`Error: ${err.message}`); }
    finally { setBusy(null); }
  }

  async function onDrain() {
    setBusy("drain"); setMsg("Generating 10 articles (most recent first)...");
    try {
      const r: any = await drain({ data: { batchId, limit: 10 } });
      setMsg(`Processed ${r.processed}${r.discarded ? `, auto-discarded ${r.discarded} removed/deleted` : ""}. ${r.remaining} pending.`);
      await refresh();
    } catch (err: any) { setMsg(`Error: ${err.message}`); }
    finally { setBusy(null); }
  }

  async function onQueueAll() {
    if (queueRunning) {
      queueAbort.current = true;
      setMsg("Stopping queue after current batch...");
      return;
    }
    queueAbort.current = false;
    setQueueRunning(true);
    let totalProcessed = 0;
    let totalDiscarded = 0;
    try {
      while (!queueAbort.current) {
        const r: any = await drain({ data: { batchId, limit: 10 } });
        totalProcessed += r.processed;
        totalDiscarded += r.discarded ?? 0;
        setMsg(`Queue: ${totalProcessed} processed, ${totalDiscarded} discarded, ${r.remaining} pending...`);
        await refresh();
        if (r.processed === 0 || r.remaining === 0) break;
      }
      setMsg(`Queue done. ${totalProcessed} generated, ${totalDiscarded} discarded.`);
    } catch (err: any) {
      setMsg(`Queue error: ${err.message}`);
    } finally {
      setQueueRunning(false);
      queueAbort.current = false;
    }
  }

  async function onPublish(postId: string) {
    setBusy(postId);
    try { await publish({ data: { postId } }); setMsg("Published."); await refresh(); }
    catch (err: any) { setMsg(`Error: ${err.message}`); }
    finally { setBusy(null); }
  }

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const { batch, items } = data;
  const pendingCount = items.filter((i: any) => i.import_status === "new").length;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link to="/admin/import" className="text-xs text-muted-foreground hover:underline">← All batches</Link>
          <h1 className="font-display text-2xl font-black text-primary">{batch.label ?? batch.id.slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {batch.total_posts} threads · {batch.total_comments} comments · {batch.total_media} media · {batch.status}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={onDrain}
            disabled={!!busy || queueRunning || pendingCount === 0}
            className="h-10 rounded-md border border-primary px-4 text-sm font-semibold text-primary disabled:opacity-50"
          >
            {busy === "drain" ? "Working..." : `Generate next 10 (${pendingCount} pending)`}
          </button>
          <button
            onClick={onQueueAll}
            disabled={!!busy && !queueRunning}
            className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {queueRunning ? "Stop queue" : `Generate all (${pendingCount})`}
          </button>
        </div>
      </div>
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Title</th>
              <th className="p-3">Flair</th>
              <th className="p-3">Original date</th>
              <th className="p-3">Status</th>
              <th className="p-3">Moderation</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any) => (
              <tr key={it.id} className="border-t align-top">
                <td className="p-3">
                  <p className="font-semibold text-primary line-clamp-2">{it.original_title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{it.reddit_post_id}</p>
                  {it.processing_error && <p className="mt-1 text-xs text-red-600">{it.processing_error}</p>}
                </td>
                <td className="p-3 text-xs">{it.link_flair_text ?? "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {it.original_created_at ? new Date(it.original_created_at).toLocaleDateString() : "—"}
                </td>
                <td className="p-3"><span className={statusBadge(it.import_status)}>{it.import_status}</span></td>
                <td className="p-3"><span className={modBadge(it.moderation_status)}>{it.moderation_status}</span></td>
                <td className="p-3 text-right">
                  {it.import_status === "new" && (
                    <button
                      onClick={() => onGen(it.id)}
                      disabled={!!busy}
                      className="h-8 rounded border border-primary px-3 text-xs font-semibold text-primary disabled:opacity-50"
                    >
                      {busy === it.id ? "..." : "Generate"}
                    </button>
                  )}
                  {it.generated_post_id && (
                    <div className="flex justify-end gap-1">
                      <Link to="/admin/posts/$id" params={{ id: it.generated_post_id }} className="h-8 inline-flex items-center rounded border px-3 text-xs font-semibold hover:bg-gray-50">Edit</Link>
                      <button
                        onClick={() => onPublish(it.generated_post_id)}
                        disabled={!!busy}
                        className="h-8 rounded bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                      >Publish</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusBadge(s: string) {
  const base = "inline-block rounded px-2 py-0.5 text-xs font-bold uppercase";
  if (s === "generated") return `${base} bg-blue-100 text-blue-800`;
  if (s === "published") return `${base} bg-emerald-100 text-emerald-800`;
  if (s === "discarded") return `${base} bg-gray-200 text-gray-700`;
  return `${base} bg-amber-100 text-amber-800`;
}
function modBadge(s: string) {
  const base = "inline-block rounded px-2 py-0.5 text-xs font-bold uppercase";
  if (s === "clear") return `${base} bg-emerald-100 text-emerald-800`;
  if (s === "review") return `${base} bg-amber-100 text-amber-800`;
  if (s === "blocked") return `${base} bg-red-100 text-red-800`;
  return `${base} bg-gray-100 text-gray-700`;
}
