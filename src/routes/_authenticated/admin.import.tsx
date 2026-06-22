import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listBatches, processArchive } from "@/lib/import-archive.functions";

export const Route = createFileRoute("/_authenticated/admin/import")({
  head: () => ({ meta: [{ title: "Archive Import — Admin" }, { name: "robots", content: "noindex" }] }),
  component: ImportPage,
});

function ImportPage() {
  const navigate = useNavigate();
  const list = useServerFn(listBatches);
  const process = useServerFn(processArchive);

  const [batches, setBatches] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState(0);

  async function refresh() {
    try { setBatches(await list()); } catch (err: any) { setStatus(`Error loading: ${err.message}`); }
  }
  useEffect(() => { refresh(); }, []);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setStatus("Uploading archive to secure storage..."); setProgress(10);
    try {
      const path = `${crypto.randomUUID()}/${file.name}`;
      const { error: upErr } = await supabase.storage.from("reddit-archives").upload(path, file, {
        contentType: "application/zip",
        upsert: false,
      });
      if (upErr) throw upErr;
      setProgress(40);
      setStatus("Parsing archive on server (this can take 30–90s for large files)...");
      const result = await process({ data: { storagePath: path, label: file.name } });
      setProgress(100);
      setStatus(`Imported ${result.totalPosts} threads, ${result.totalComments} comments, ${result.totalMedia} media files.`);
      setFile(null);
      await refresh();
      navigate({ to: "/admin/import/$batchId", params: { batchId: result.batchId } });
    } catch (err: any) {
      setStatus(`Error: ${err.message ?? err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-black text-primary">Archive Import</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a Reddit archive ZIP. Posts become drafts; you decide what gets published.
      </p>

      <form onSubmit={onUpload} className="mt-6 rounded-lg border bg-white p-4">
        <input
          type="file"
          accept=".zip,application/zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
          className="block w-full text-sm"
        />
        {file && <p className="mt-2 text-xs text-muted-foreground">{file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
        <button
          type="submit"
          disabled={!file || busy}
          className="mt-3 h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Working..." : "Upload & Process"}
        </button>
        {busy && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded bg-gray-200">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {status && <p className="mt-2 text-xs text-muted-foreground">{status}</p>}
      </form>

      <h2 className="mt-8 font-display text-lg font-bold text-primary">Recent batches</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">Label</th><th className="p-3">Status</th><th className="p-3">Posts</th><th className="p-3">Comments</th><th className="p-3">Media</th><th className="p-3">When</th></tr>
          </thead>
          <tbody>
            {batches.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No batches yet.</td></tr>}
            {batches.map((b) => (
              <tr key={b.id} className="border-t hover:bg-gray-50">
                <td className="p-3"><Link to="/admin/import/$batchId" params={{ batchId: b.id }} className="font-semibold text-primary hover:underline">{b.label ?? b.id.slice(0, 8)}</Link></td>
                <td className="p-3"><span className={statusClass(b.status)}>{b.status}</span></td>
                <td className="p-3">{b.total_posts}</td>
                <td className="p-3">{b.total_comments}</td>
                <td className="p-3">{b.total_media}</td>
                <td className="p-3 text-muted-foreground">{new Date(b.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusClass(s: string) {
  const base = "inline-block rounded px-2 py-0.5 text-xs font-bold uppercase";
  if (s === "complete") return `${base} bg-emerald-100 text-emerald-800`;
  if (s === "error") return `${base} bg-red-100 text-red-800`;
  if (s === "processing") return `${base} bg-amber-100 text-amber-800`;
  return `${base} bg-gray-100 text-gray-700`;
}
