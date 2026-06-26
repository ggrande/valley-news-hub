import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminOpenBattle, adminToggleControversial } from "@/lib/verdict.functions";
import { useSettingEnabled } from "@/lib/use-verdict-enabled";

export const Route = createFileRoute("/_authenticated/admin/posts/$id")({
  component: PostEditor,
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

const STATUSES = ["draft", "review", "published", "archived"];

function PostEditor() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const [form, setForm] = useState<any>({
    title: "", slug: "", dek: "", body: "", status: "draft",
    category_id: "", author_id: "", is_breaking: false, is_weather_alert: false, is_pinned: false,
    seo_title: "", seo_description: "", featured_image: "", editor_notes: "", verification_notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cats = useQuery({ queryKey: ["cats"], queryFn: async () => (await supabase.from("categories").select("id,name,slug").order("sort_order")).data ?? [] });
  const auths = useQuery({ queryKey: ["auths"], queryFn: async () => (await supabase.from("authors").select("id,name,slug").order("name")).data ?? [] });

  const existing = useQuery({
    queryKey: ["post", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing.data) setForm({ ...existing.data, category_id: existing.data.category_id ?? "", author_id: existing.data.author_id ?? "" });
  }, [existing.data]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async (publish = false) => {
    setSaving(true);
    setMsg(null);
    const payload: any = {
      title: form.title,
      slug: form.slug || slugify(form.title),
      dek: form.dek,
      body: form.body,
      status: publish ? "published" : form.status,
      category_id: form.category_id || null,
      author_id: form.author_id || null,
      is_breaking: !!form.is_breaking,
      is_weather_alert: !!form.is_weather_alert,
      is_pinned: !!form.is_pinned,
      seo_title: form.seo_title || null,
      seo_description: form.seo_description || null,
      featured_image: form.featured_image || null,
      editor_notes: form.editor_notes || null,
      verification_notes: form.verification_notes || null,
      updated_at: new Date().toISOString(),
    };
    if (publish && !form.published_at) {
      // Back-date to the originating Reddit post date when available.
      let backDate: string | null = null;
      if (!isNew) {
        const { data: p } = await supabase
          .from("posts")
          .select("reddit_imports:reddit_imports(original_created_at)")
          .eq("id", id!)
          .maybeSingle();
        backDate = (p as any)?.reddit_imports?.original_created_at ?? null;
      }
      payload.published_at = backDate ?? new Date().toISOString();
    }

    let result;
    if (isNew) {
      result = await supabase.from("posts").insert(payload).select("id").single();
    } else {
      result = await supabase.from("posts").update(payload).eq("id", id).select("id").single();
    }
    setSaving(false);
    if (result.error) {
      console.error("Post save failed:", result.error);
      setMsg(`Save failed: ${result.error.message}`);
      return;
    }
    if (!result.data) {
      setMsg("Save failed: no row returned (check permissions).");
      return;
    }
    setMsg(`Saved ${new Date().toLocaleTimeString()}`);
    if (isNew && result.data?.id) navigate({ to: "/admin/posts/$id", params: { id: result.data.id } });
  };

  const remove = async () => {
    if (!confirm("PERMANENTLY DELETE this post? This cannot be undone.")) return;
    await supabase.from("post_tags").delete().eq("post_id", id);
    await supabase.from("post_versions").delete().eq("post_id", id);
    await supabase.from("comments").delete().eq("post_id", id);
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) { setMsg(`Delete failed: ${error.message}`); return; }
    navigate({ to: "/admin/posts" });
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-black text-primary">{isNew ? "New Post" : "Edit Post"}</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 rounded-lg border bg-white p-6">
          <Field label="Title"><input className="h-10 w-full rounded border px-3" value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Slug"><input className="h-10 w-full rounded border px-3" value={form.slug} placeholder={slugify(form.title || "")} onChange={(e) => set("slug", e.target.value)} /></Field>
          <Field label="Dek / Summary"><textarea rows={2} className="w-full rounded border px-3 py-2" value={form.dek ?? ""} onChange={(e) => set("dek", e.target.value)} /></Field>
          <Field label="Body"><textarea rows={18} className="w-full rounded border px-3 py-2 font-news" value={form.body ?? ""} onChange={(e) => set("body", e.target.value)} /></Field>
          <Field label="Featured image URL"><input className="h-10 w-full rounded border px-3" value={form.featured_image ?? ""} onChange={(e) => set("featured_image", e.target.value)} /></Field>
          <details className="rounded border p-3">
            <summary className="cursor-pointer text-sm font-semibold">SEO & Notes</summary>
            <div className="mt-3 space-y-3">
              <Field label="SEO Title"><input className="h-10 w-full rounded border px-3" value={form.seo_title ?? ""} onChange={(e) => set("seo_title", e.target.value)} /></Field>
              <Field label="SEO Description"><textarea rows={2} className="w-full rounded border px-3 py-2" value={form.seo_description ?? ""} onChange={(e) => set("seo_description", e.target.value)} /></Field>
              <Field label="Editor notes (internal)"><textarea rows={3} className="w-full rounded border px-3 py-2" value={form.editor_notes ?? ""} onChange={(e) => set("editor_notes", e.target.value)} /></Field>
              <Field label="Verification notes (internal)"><textarea rows={3} className="w-full rounded border px-3 py-2" value={form.verification_notes ?? ""} onChange={(e) => set("verification_notes", e.target.value)} /></Field>
            </div>
          </details>
        </div>
        <aside className="space-y-4">
          <div className="rounded-lg border bg-white p-5">
            <Field label="Status">
              <select className="h-10 w-full rounded border px-3" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select className="h-10 w-full rounded border px-3" value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
                <option value="">—</option>
                {cats.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Author">
              <select className="h-10 w-full rounded border px-3" value={form.author_id} onChange={(e) => set("author_id", e.target.value)}>
                <option value="">—</option>
                {auths.data?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <div className="mt-3 space-y-2 text-sm">
              <Toggle label="Breaking news" v={form.is_breaking} on={(v) => set("is_breaking", v)} />
              <Toggle label="Weather alert" v={form.is_weather_alert} on={(v) => set("is_weather_alert", v)} />
              <Toggle label="Pinned / featured" v={form.is_pinned} on={(v) => set("is_pinned", v)} />
              <VerdictControls postId={isNew ? null : id!} initialControversial={!!form.is_controversial} />
            </div>
            <div className="mt-4 space-y-2">
              <button disabled={saving} onClick={() => save(false)} className="h-10 w-full rounded bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">Save</button>
              <button disabled={saving} onClick={() => save(true)} className="h-10 w-full rounded bg-emerald-700 text-sm font-semibold text-white disabled:opacity-60">Save & Publish</button>
              {!isNew && <button onClick={remove} className="h-10 w-full rounded border border-red-300 text-sm font-semibold text-red-700">Delete</button>}
              {msg && <p className="text-center text-xs text-muted-foreground">{msg}</p>}
            </div>
          </div>
          {form.source_type && form.source_type !== "original" && (
            <div className="rounded-lg border bg-amber-50 p-4 text-xs text-amber-900">
              <p className="font-semibold uppercase tracking-wide">Source: {form.source_type}</p>
              {form.source_url && <a href={form.source_url} className="mt-1 block break-all hover:underline" target="_blank" rel="noreferrer">{form.source_url}</a>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-primary">{label}</span>{children}</label>;
}
function Toggle({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return <label className="flex items-center gap-2"><input type="checkbox" checked={!!v} onChange={(e) => on(e.target.checked)} /> {label}</label>;
}

function VerdictControls({ postId, initialControversial }: { postId: string | null; initialControversial: boolean }) {
  const enabled = useSettingEnabled();
  const [contro, setContro] = useState(initialControversial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!enabled || !postId) return null;
  const toggle = async (v: boolean) => {
    setContro(v);
    setBusy(true);
    try {
      await (adminToggleControversial as any)({ data: { postId, value: v } });
    } finally { setBusy(false); }
  };
  const open = async (ghostMode: "off" | "subtle" | "aggressive") => {
    setBusy(true); setMsg(null);
    try {
      const r: any = await (adminOpenBattle as any)({ data: { postId, ghostMode } });
      setMsg(r?.alreadyOpen ? "Battle already live" : "Battle opened");
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-2 rounded border border-primary/30 bg-primary/5 p-2">
      <label className="flex items-center gap-2"><input type="checkbox" checked={contro} onChange={(e) => toggle(e.target.checked)} disabled={busy} /> ⚖️ Controversial (allow Verdict Arena)</label>
      {contro && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => open("subtle")} disabled={busy} className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50">Open battle (subtle ghosts)</button>
          <button type="button" onClick={() => open("aggressive")} disabled={busy} className="rounded border border-primary px-2 py-1 text-xs font-semibold disabled:opacity-50">Aggressive ghosts</button>
          <button type="button" onClick={() => open("off")} disabled={busy} className="rounded border px-2 py-1 text-xs disabled:opacity-50">No ghosts</button>
        </div>
      )}
      {msg && <p className="mt-1 text-[10px] text-muted-foreground">{msg}</p>}
    </div>
  );
}
