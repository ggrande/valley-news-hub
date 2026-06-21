import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/reddit/$id")({
  component: IntakeDetail,
});

const VARIATIONS = [
  { key: "default", label: "Generate News Article" },
  { key: "shorter", label: "Shorter Version" },
  { key: "fuller", label: "Fuller Version" },
  { key: "tv_tone", label: "More Local-TV Tone" },
  { key: "breaking", label: "As Breaking News" },
  { key: "community", label: "As Community Feature" },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

function IntakeDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [generated, setGenerated] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmGen, setConfirmGen] = useState(false);

  const intake = useQuery({
    queryKey: ["intake", id],
    queryFn: async () => (await supabase.from("reddit_imports").select("*").eq("id", id).maybeSingle()).data,
  });
  const comments = useQuery({
    queryKey: ["intake-comments", id],
    queryFn: async () => (await supabase.from("reddit_import_comments").select("*").eq("reddit_import_id", id).order("nesting_level").order("created_at")).data ?? [],
  });

  const generate = async (variation: string) => {
    if (!confirmGen) { setConfirmGen(true); return; }
    setBusy(true); setErr(null); setGenerated(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-article", { body: { reddit_import_id: id, variation } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGenerated(data.generated);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const createDraft = async () => {
    if (!generated) return;
    // Resolve category by name
    const { data: cats } = await supabase.from("categories").select("id,name");
    const catMatch = cats?.find((c: any) => c.name.toLowerCase() === String(generated.category ?? "").toLowerCase());
    const { data: post, error } = await supabase.from("posts").insert({
      slug: slugify(generated.headline ?? intake.data?.original_title ?? "post") + "-" + Date.now().toString(36).slice(-4),
      title: generated.headline ?? "Untitled",
      dek: generated.dek ?? null,
      body: generated.body ?? "",
      status: "draft",
      source_type: "reddit_import",
      source_url: intake.data?.source_url ?? null,
      source_subreddit: intake.data?.subreddit ?? null,
      source_post_id: intake.data?.reddit_post_id ?? null,
      original_source_title: intake.data?.original_title ?? null,
      original_source_body: intake.data?.original_body ?? null,
      generated_version: JSON.stringify(generated),
      seo_title: generated.seo_title ?? null,
      seo_description: generated.seo_description ?? null,
      category_id: catMatch?.id ?? null,
      verification_notes: generated.verification_notes ?? null,
      editor_notes: `Comment summary: ${generated.comment_summary ?? ""}\nRisk flags: ${(generated.risk_flags ?? []).join(", ")}`,
      reddit_import_id: id,
    }).select("id").single();
    if (error) { setErr(error.message); return; }

    // Copy comments to the article as discussion comments
    const sorted = (comments.data ?? []).slice().sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));
    if (sorted.length) {
      const rows = sorted.map((c: any, i: number) => ({
        post_id: post.id,
        source_type: "reddit",
        source_comment_id: c.source_comment_id,
        parent_source_comment_id: c.parent_source_comment_id,
        display_name: c.display_name ?? "redditor",
        body: c.body,
        score: c.score,
        source_created_at: c.source_created_at,
        nesting_level: Math.min(c.nesting_level ?? 0, 3),
        sort_order: i,
      }));
      await supabase.from("comments").insert(rows as any);
    }
    await supabase.from("reddit_imports").update({ import_status: "generated", generated_post_id: post.id }).eq("id", id);
    navigate({ to: "/admin/posts/$id", params: { id: post.id } });
  };

  if (!intake.data) return <p>Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-black text-primary">Reddit Intake</h1>
        <Link to="/admin/reddit" className="text-sm text-muted-foreground hover:underline">← Back</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-5">
          <h2 className="font-display text-lg font-bold text-primary">Original Source</h2>
          <p className="mt-1 text-xs text-muted-foreground">r/{intake.data.subreddit ?? "?"} • {intake.data.original_author_display ?? "?"}</p>
          <p className="mt-3 font-semibold">{intake.data.original_title}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{intake.data.original_body}</p>
          {intake.data.source_url && <a href={intake.data.source_url} target="_blank" rel="noreferrer" className="mt-3 block break-all text-xs text-[color:var(--broadcast)] hover:underline">{intake.data.source_url}</a>}
        </div>
        <div className="rounded-lg border bg-white p-5">
          <h2 className="font-display text-lg font-bold text-primary">Comments ({comments.data?.length ?? 0})</h2>
          <ul className="mt-3 max-h-96 space-y-3 overflow-auto text-sm">
            {comments.data?.map((c: any) => (
              <li key={c.id} className="border-b pb-2" style={{ paddingLeft: (c.nesting_level ?? 0) * 12 }}>
                <p className="text-xs font-semibold text-primary">{c.display_name} <span className="text-muted-foreground">· {c.score ?? 0} pts</span></p>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-5">
        <h2 className="font-display text-lg font-bold text-primary">AI Generation</h2>
        {!confirmGen && (
          <p className="mt-1 text-xs text-amber-700">⚠️ AI generation consumes Lovable AI credits. Click any variation again to confirm.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {VARIATIONS.map((v) => (
            <button key={v.key} disabled={busy} onClick={() => generate(v.key)} className="rounded border px-3 py-2 text-sm hover:bg-accent disabled:opacity-60">
              {confirmGen ? v.label : `▶ ${v.label}`}
            </button>
          ))}
        </div>
        {busy && <p className="mt-3 text-sm text-muted-foreground">Generating…</p>}
        {err && <p className="mt-3 text-sm text-[color:var(--breaking)]">{err}</p>}

        {generated && (
          <div className="mt-5 space-y-3 rounded border bg-[color:var(--ivory)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--breaking)]">{generated.category ?? "News"}</p>
            <h3 className="font-display text-xl font-black text-primary">{generated.headline}</h3>
            <p className="font-news text-base text-muted-foreground">{generated.dek}</p>
            <article className="whitespace-pre-wrap text-sm leading-relaxed">{generated.body}</article>
            <details className="text-xs"><summary className="cursor-pointer font-semibold">Admin notes</summary>
              <div className="mt-2 space-y-2">
                <p><strong>Verification:</strong> {generated.verification_notes}</p>
                <p><strong>Comment summary:</strong> {generated.comment_summary}</p>
                <p><strong>Risk flags:</strong> {(generated.risk_flags ?? []).join(", ")}</p>
                <p><strong>Suggested image:</strong> {generated.suggested_image_prompt}</p>
              </div>
            </details>
            <button onClick={createDraft} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save as Draft Post</button>
          </div>
        )}
      </div>
    </div>
  );
}
