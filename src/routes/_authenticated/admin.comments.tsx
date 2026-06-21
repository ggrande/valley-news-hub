import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/comments")({
  component: CommentsAdmin,
});

function CommentsAdmin() {
  const q = useQuery({
    queryKey: ["admin-comments"],
    queryFn: async () => (await supabase.from("comments").select("id, display_name, body, score, is_featured, is_hidden, moderation_status, source_type, post:posts(slug,title)").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  const toggle = async (id: string, field: "is_featured" | "is_hidden", value: boolean) => {
    await supabase.from("comments").update({ [field]: value }).eq("id", id);
    q.refetch();
  };

  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-3xl font-black text-primary">Comments</h1><p className="text-sm text-muted-foreground">Manage imported and posted discussion comments.</p></div>
      <div className="space-y-3">
        {q.data?.map((c: any) => (
          <div key={c.id} className={`rounded-lg border bg-white p-4 ${c.is_hidden ? "opacity-50" : ""}`}>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-primary">{c.display_name}</span> • {c.source_type} • on <a href={`/news/${c.post?.slug ?? ""}`} className="hover:underline">{c.post?.title ?? "?"}</a>
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{c.body}</p>
            <div className="mt-3 flex gap-2 text-xs">
              <button onClick={() => toggle(c.id, "is_featured", !c.is_featured)} className={`rounded border px-3 py-1 ${c.is_featured ? "bg-[color:var(--gold)]/30" : ""}`}>{c.is_featured ? "★ Featured" : "Feature"}</button>
              <button onClick={() => toggle(c.id, "is_hidden", !c.is_hidden)} className={`rounded border px-3 py-1 ${c.is_hidden ? "bg-red-100" : ""}`}>{c.is_hidden ? "Hidden" : "Hide"}</button>
            </div>
          </div>
        ))}
        {q.data?.length === 0 && <p className="text-muted-foreground">No comments yet.</p>}
      </div>
    </div>
  );
}
