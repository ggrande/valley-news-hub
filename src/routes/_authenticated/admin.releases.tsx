import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  listAllReleases,
  upsertRelease,
  publishRelease,
  unpublishRelease,
  deleteRelease,
  getReleaseDownloadUrl,
} from "@/lib/network-releases.functions";

export const Route = createFileRoute("/_authenticated/admin/releases")({
  head: () => ({ meta: [{ title: "Releases — WKNA 49 Admin" }, { name: "robots", content: "noindex" }] }),
  component: ReleasesAdmin,
});

type ReleaseRow = {
  id: string;
  version: string;
  channel: string;
  title: string;
  changelog_md: string;
  breaking: boolean;
  security: boolean;
  zip_path: string | null;
  zip_sha256: string | null;
  zip_bytes: number | null;
  published_at: string | null;
  created_at: string;
};

const blank = {
  version: "",
  channel: "stable" as "stable" | "beta",
  title: "",
  changelog_md: "",
  breaking: false,
  security: false,
};

function ReleasesAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listAllReleases);
  const upsert = useServerFn(upsertRelease);
  const publish = useServerFn(publishRelease);
  const unpublish = useServerFn(unpublishRelease);
  const del = useServerFn(deleteRelease);
  const signUrl = useServerFn(getReleaseDownloadUrl);

  const q = useQuery({
    queryKey: ["admin_releases"],
    queryFn: () => list(),
  });

  const [draft, setDraft] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) return;
    const row = q.data?.find((r) => r.id === editingId);
    if (row) {
      setDraft({
        version: row.version,
        channel: row.channel as "stable" | "beta",
        title: row.title,
        changelog_md: row.changelog_md,
        breaking: row.breaking,
        security: row.security,
      });
    }
  }, [editingId, q.data]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin_releases"] });

  const resetForm = () => {
    setDraft(blank);
    setEditingId(null);
    setZipFile(null);
  };

  const save = async () => {
    if (!draft.version.trim() || !draft.title.trim()) {
      toast.error("Version and title are required");
      return;
    }
    setSaving(true);
    try {
      // 1. Upsert metadata (without zip fields if no new upload)
      const existing = editingId ? q.data?.find((r) => r.id === editingId) : null;
      const meta = await upsert({
        data: {
          ...(editingId ? { id: editingId } : {}),
          version: draft.version,
          channel: draft.channel,
          title: draft.title,
          changelog_md: draft.changelog_md,
          breaking: draft.breaking,
          security: draft.security,
          zip_path: existing?.zip_path ?? null,
          zip_sha256: existing?.zip_sha256 ?? null,
          zip_bytes: existing?.zip_bytes ?? null,
        },
      });
      const id = meta.id;

      // 2. If a ZIP was selected, upload + compute sha256 + update row
      if (zipFile) {
        const sha = await sha256Hex(zipFile);
        const path = `${id}/wkna49-platform-v${draft.version}.zip`;
        const { error: upErr } = await supabase.storage
          .from("network-releases")
          .upload(path, zipFile, { upsert: true, contentType: "application/zip" });
        if (upErr) throw upErr;
        await upsert({
          data: {
            id,
            version: draft.version,
            channel: draft.channel,
            title: draft.title,
            changelog_md: draft.changelog_md,
            breaking: draft.breaking,
            security: draft.security,
            zip_path: path,
            zip_sha256: sha,
            zip_bytes: zipFile.size,
          },
        });
      }

      toast.success(editingId ? "Release updated" : "Release drafted");
      resetForm();
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async (id: string) => {
    setBusy(id);
    try {
      await publish({ data: { id } });
      toast.success("Published");
      refresh();
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setBusy(null);
    }
  };
  const onUnpublish = async (id: string) => {
    setBusy(id);
    try {
      await unpublish({ data: { id } });
      toast.success("Unpublished");
      refresh();
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setBusy(null);
    }
  };
  const onDelete = async (id: string) => {
    if (!confirm("Delete this release? The ZIP will be removed too.")) return;
    setBusy(id);
    try {
      await del({ data: { id } });
      toast.success("Deleted");
      refresh();
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setBusy(null);
    }
  };
  const onDownload = async (id: string) => {
    try {
      const { url } = await signUrl({ data: { id } });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-black text-primary">Platform Releases</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Draft, attach a scrubbed ZIP, and publish releases. Published entries appear on{" "}
          <a className="underline" href="/network/changelog">/network/changelog</a> and are served to
          self-hosters via the update-check endpoint.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="font-display text-xl font-bold text-primary">
          {editingId ? `Edit release` : `New release`}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-semibold">Version (semver)</span>
            <input
              value={draft.version}
              onChange={(e) => setDraft((d) => ({ ...d, version: e.target.value }))}
              placeholder="1.4.0"
              className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="font-semibold">Channel</span>
            <select
              value={draft.channel}
              onChange={(e) => setDraft((d) => ({ ...d, channel: e.target.value as any }))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            >
              <option value="stable">stable</option>
              <option value="beta">beta</option>
            </select>
          </label>
        </div>
        <label className="mt-4 block text-sm">
          <span className="font-semibold">Title</span>
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Reddit comment automation + per-tenant CMS"
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>
        <label className="mt-4 block text-sm">
          <span className="font-semibold">Release notes (Markdown)</span>
          <textarea
            value={draft.changelog_md}
            onChange={(e) => setDraft((d) => ({ ...d, changelog_md: e.target.value }))}
            rows={10}
            className="mt-1 w-full rounded border px-3 py-2 font-mono text-xs"
            placeholder={"## New\n- ...\n\n## Fixed\n- ..."}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.breaking} onChange={(e) => setDraft((d) => ({ ...d, breaking: e.target.checked }))} />
            Breaking change
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.security} onChange={(e) => setDraft((d) => ({ ...d, security: e.target.checked }))} />
            Security update
          </label>
        </div>
        <label className="mt-4 block text-sm">
          <span className="font-semibold">Scrubbed ZIP {editingId ? "(optional — leave blank to keep existing)" : ""}</span>
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
          {zipFile && (
            <p className="mt-1 text-xs text-muted-foreground">
              {zipFile.name} ({(zipFile.size / 1024 / 1024).toFixed(2)} MB) — sha256 computed in-browser before upload.
            </p>
          )}
        </label>
        <div className="mt-5 flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="h-9 rounded-md bg-[color:var(--breaking)] px-4 text-sm font-semibold text-white hover:bg-[color:var(--breaking)]/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : editingId ? "Save changes" : "Save draft"}
          </button>
          {editingId && (
            <button onClick={resetForm} className="h-9 rounded-md border px-4 text-sm font-semibold">
              Cancel
            </button>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="font-display text-xl font-bold text-primary">All releases</h2>
        {q.isLoading && <p className="mt-2 text-sm text-muted-foreground">Loading…</p>}
        {q.error && <p className="mt-2 text-sm text-red-600">{(q.error as Error).message}</p>}
        <div className="mt-4 space-y-3">
          {(q.data ?? []).map((r: ReleaseRow) => (
            <article key={r.id} className="rounded border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold">v{r.version}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{r.channel}</span>
                {r.breaking && <span className="rounded bg-red-100 px-2 py-0.5 text-xs">breaking</span>}
                {r.security && <span className="rounded bg-orange-100 px-2 py-0.5 text-xs">security</span>}
                {r.published_at ? (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs">published {new Date(r.published_at).toLocaleDateString()}</span>
                ) : (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs">draft</span>
                )}
                {r.zip_path && (
                  <span className="text-xs text-muted-foreground">
                    {(r.zip_bytes ? (r.zip_bytes / 1024 / 1024).toFixed(2) : "?")} MB
                  </span>
                )}
                <div className="ml-auto flex flex-wrap gap-2">
                  <button onClick={() => setEditingId(r.id)} className="h-7 rounded border px-2 text-xs">Edit</button>
                  {r.zip_path && (
                    <button onClick={() => onDownload(r.id)} className="h-7 rounded border px-2 text-xs">Download</button>
                  )}
                  {r.published_at ? (
                    <button disabled={busy === r.id} onClick={() => onUnpublish(r.id)} className="h-7 rounded border px-2 text-xs">Unpublish</button>
                  ) : (
                    <button disabled={busy === r.id || !r.zip_path} onClick={() => onPublish(r.id)} className="h-7 rounded bg-emerald-600 px-2 text-xs font-semibold text-white disabled:opacity-50">
                      Publish
                    </button>
                  )}
                  <button disabled={busy === r.id} onClick={() => onDelete(r.id)} className="h-7 rounded border px-2 text-xs text-red-600">Delete</button>
                </div>
              </div>
              <h3 className="mt-2 text-sm font-semibold">{r.title}</h3>
              {r.zip_sha256 && (
                <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">sha256: {r.zip_sha256}</p>
              )}
            </article>
          ))}
          {!q.isLoading && (q.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No releases yet. Draft your first release above.</p>
          )}
        </div>
      </section>
    </div>
  );
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
