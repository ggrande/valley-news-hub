import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/posts")({
  component: PostsList,
});

function PostsList() {
  const q = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, slug, title, status, is_breaking, published_at, updated_at, category:categories(name), author:authors(name)")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-primary">Posts</h1>
          <p className="text-sm text-muted-foreground">All articles, drafts, and review items.</p>
        </div>
        <Link to="/admin/posts/$id" params={{ id: "new" }} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">+ New post</Link>
      </div>
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--ivory)] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="p-3">Title</th><th className="p-3">Status</th><th className="p-3">Category</th><th className="p-3">Author</th><th className="p-3">Updated</th></tr>
          </thead>
          <tbody>
            {q.data?.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  <Link to="/admin/posts/$id" params={{ id: p.id }} className="font-semibold text-primary hover:underline">{p.title}</Link>
                  {p.is_breaking && <span className="ml-2 rounded bg-[color:var(--breaking)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Breaking</span>}
                  <div className="text-xs text-muted-foreground">/news/{p.slug}</div>
                </td>
                <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${p.status === "published" ? "bg-emerald-100 text-emerald-800" : p.status === "draft" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{p.status}</span></td>
                <td className="p-3">{p.category?.name ?? "—"}</td>
                <td className="p-3">{p.author?.name ?? "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {q.data?.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No posts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
