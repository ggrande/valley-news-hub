import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateFillerImage } from "@/lib/filler-image.functions";

export const Route = createFileRoute("/_authenticated/admin/posts")({
  component: PostsList,
});

type StatusFilter = "all" | "draft" | "review" | "published" | "archived";

function PostsList() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, slug, title, status, is_breaking, featured_image, published_at, updated_at, category:categories(name), author:authors(name)")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const all = q.data ?? [];
    return filter === "all" ? all : all.filter((p: any) => p.status === filter);
  }, [q.data, filter]);

  const draftIdsVisible = useMemo(
    () => rows.filter((p: any) => p.status === "draft").map((p: any) => p.id as string),
    [rows],
  );
  const selectedDraftIds = useMemo(
    () => draftIdsVisible.filter((id) => selected.has(id)),
    [draftIdsVisible, selected],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllDrafts = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = draftIdsVisible.every((id) => next.has(id));
      if (allSelected) draftIdsVisible.forEach((id) => next.delete(id));
      else draftIdsVisible.forEach((id) => next.add(id));
      return next;
    });
  };

  const bulkPublish = async () => {
    if (selectedDraftIds.length === 0) return;
    if (!confirm(`Publish ${selectedDraftIds.length} draft post(s)?`)) return;
    setBusy(true);
    setMsg(null);
    // For posts missing published_at, backfill from the originating
    // reddit_imports.original_created_at so the article publishes under the
    // original Reddit post date (back-dated by design).
    const { data: needDate } = await supabase
      .from("posts")
      .select("id, reddit_imports:reddit_imports(original_created_at)")
      .in("id", selectedDraftIds)
      .is("published_at", null);
    const nowIso = new Date().toISOString();
    for (const row of (needDate ?? []) as any[]) {
      const dt = row.reddit_imports?.original_created_at ?? nowIso;
      await supabase.from("posts").update({ status: "published", published_at: dt }).eq("id", row.id);
    }
    const { error: e2 } = await supabase
      .from("posts")
      .update({ status: "published" })
      .in("id", selectedDraftIds)
      .not("published_at", "is", null);
    setBusy(false);
    if (e2) {
      setMsg(e2.message);
      return;
    }
    setMsg(`Published ${selectedDraftIds.length} post(s).`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["admin-posts"] });
  };

  const bulkArchive = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Archive ${ids.length} post(s)?`)) return;
    setBusy(true);
    const { error } = await supabase.from("posts").update({ status: "archived" }).in("id", ids);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg(`Archived ${ids.length} post(s).`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["admin-posts"] });
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`PERMANENTLY DELETE ${ids.length} post(s)? This cannot be undone.`)) return;
    setBusy(true);
    setMsg(null);
    await supabase.from("post_tags").delete().in("post_id", ids);
    await supabase.from("post_versions").delete().in("post_id", ids);
    await supabase.from("comments").delete().in("post_id", ids);
    const { error } = await supabase.from("posts").delete().in("id", ids);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg(`Deleted ${ids.length} post(s).`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["admin-posts"] });
  };

  const missingImgIdsVisible = useMemo(
    () => rows.filter((p: any) => !p.featured_image).map((p: any) => p.id as string),
    [rows],
  );
  const bulkGenImages = async () => {
    const ids = selected.size > 0
      ? [...selected].filter((id) => missingImgIdsVisible.includes(id))
      : missingImgIdsVisible;
    if (ids.length === 0) { setMsg("No posts missing a header image in current view."); return; }
    if (!confirm(`Generate filler images for ${ids.length} post(s)? This calls the AI gateway.`)) return;
    setBusy(true);
    setMsg(`Generating 0/${ids.length}…`);
    let ok = 0, fail = 0;
    for (let i = 0; i < ids.length; i++) {
      try {
        await generateFillerImage({ data: { postId: ids[i] } });
        ok++;
      } catch (e: any) {
        fail++;
        console.error("filler image fail", ids[i], e);
      }
      setMsg(`Generating ${i + 1}/${ids.length}… (${ok} ok, ${fail} fail)`);
    }
    setBusy(false);
    setMsg(`Done. ${ok} generated, ${fail} failed.`);
    qc.invalidateQueries({ queryKey: ["admin-posts"] });
  };

  const genOne = async (id: string) => {
    setBusy(true);
    try {
      await generateFillerImage({ data: { postId: id, force: true } });
      setMsg("Generated.");
      qc.invalidateQueries({ queryKey: ["admin-posts"] });
    } catch (e: any) {
      setMsg(e?.message ?? "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const allDraftsChecked = draftIdsVisible.length > 0 && draftIdsVisible.every((id) => selected.has(id));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-primary">Posts</h1>
          <p className="text-sm text-muted-foreground">All articles, drafts, and review items.</p>
        </div>
        <Link to="/admin/posts/$id" params={{ id: "new" }} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">+ New post</Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3">
        <div className="flex gap-1">
          {(["all", "draft", "review", "published", "archived"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded px-3 py-1 text-xs font-semibold uppercase tracking-wide ${filter === s ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{selected.size} selected</span>
          <button
            disabled={busy || selectedDraftIds.length === 0}
            onClick={bulkPublish}
            className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Publish drafts ({selectedDraftIds.length})
          </button>
          <button
            disabled={busy || selected.size === 0}
            onClick={bulkArchive}
            className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
          >
            Archive
          </button>
          <button
            disabled={busy || selected.size === 0}
            onClick={bulkDelete}
            className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Delete
          </button>
          <button
            disabled={busy}
            onClick={bulkGenImages}
            className="rounded bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            title={selected.size > 0 ? "Generate filler images for selected posts missing one" : "Generate filler images for all visible posts missing one"}
          >
            Gen filler images ({selected.size > 0 ? [...selected].filter((id) => missingImgIdsVisible.includes(id)).length : missingImgIdsVisible.length})
          </button>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:underline">
              Clear
            </button>
          )}
        </div>
        {msg && <p className="w-full text-xs text-muted-foreground">{msg}</p>}
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--ivory)] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  checked={allDraftsChecked}
                  onChange={toggleAllDrafts}
                  title="Select all visible drafts"
                  aria-label="Select all visible drafts"
                />
              </th>
              <th className="p-3">Title</th>
              <th className="p-3">Status</th>
              <th className="p-3">Category</th>
              <th className="p-3">Author</th>
              <th className="p-3">Image</th>
              <th className="p-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    aria-label={`Select ${p.title}`}
                  />
                </td>
                <td className="p-3">
                  <Link to="/admin/posts/$id" params={{ id: p.id }} className="font-semibold text-primary hover:underline">{p.title}</Link>
                  {p.is_breaking && <span className="ml-2 rounded bg-[color:var(--breaking)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Breaking</span>}
                  <div className="text-xs text-muted-foreground">/news/{p.slug}</div>
                </td>
                <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${p.status === "published" ? "bg-emerald-100 text-emerald-800" : p.status === "draft" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{p.status}</span></td>
                <td className="p-3">{p.category?.name ?? "—"}</td>
                <td className="p-3">{p.author?.name ?? "—"}</td>
                <td className="p-3">
                  {p.featured_image ? (
                    <button onClick={() => genOne(p.id)} disabled={busy} className="text-xs text-muted-foreground hover:underline disabled:opacity-50" title="Regenerate">✓ regen</button>
                  ) : (
                    <button onClick={() => genOne(p.id)} disabled={busy} className="rounded bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-800 disabled:opacity-50">Gen</button>
                  )}
                </td>
                <td className="p-3 text-xs text-muted-foreground">{p.published_at ? new Date(p.published_at).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No posts.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
