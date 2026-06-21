import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

function Stat({ label, value, to }: { label: string; value: number | string; to?: string }) {
  const body = (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-black text-primary">{value}</p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function Dashboard() {
  const counts = useQuery({
    queryKey: ["admin-counts"],
    queryFn: async () => {
      const tables = ["posts", "reddit_imports", "comments", "news_tips", "community_events", "contact_submissions", "ad_inquiries", "newsletters"] as const;
      const out: Record<string, number> = {};
      await Promise.all(tables.map(async (t) => {
        const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
        out[t] = count ?? 0;
      }));
      const { count: published } = await supabase.from("posts").select("*", { count: "exact", head: true }).eq("status", "published");
      const { count: drafts } = await supabase.from("posts").select("*", { count: "exact", head: true }).eq("status", "draft");
      out.published = published ?? 0;
      out.drafts = drafts ?? 0;
      return out;
    },
  });

  const c = counts.data ?? {};
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-black text-primary">Newsroom Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of content, intake, and submissions.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Published posts" value={c.published ?? 0} to="/admin/posts" />
        <Stat label="Drafts" value={c.drafts ?? 0} to="/admin/posts" />
        <Stat label="Reddit intakes" value={c.reddit_imports ?? 0} to="/admin/reddit" />
        <Stat label="Comments" value={c.comments ?? 0} to="/admin/comments" />
        <Stat label="News tips" value={c.news_tips ?? 0} to="/admin/submissions" />
        <Stat label="Community events" value={c.community_events ?? 0} to="/admin/submissions" />
        <Stat label="Contact messages" value={c.contact_submissions ?? 0} to="/admin/submissions" />
        <Stat label="Newsletter subs" value={c.newsletters ?? 0} />
      </div>
      <div className="rounded-lg border bg-white p-6">
        <h2 className="font-display text-lg font-bold text-primary">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/admin/posts/$id" params={{ id: "new" }} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">New post</Link>
          <Link to="/admin/reddit" className="rounded-md border px-4 py-2 text-sm font-semibold">New Reddit intake</Link>
          <Link to="/admin/settings" className="rounded-md border px-4 py-2 text-sm font-semibold">Site settings</Link>
        </div>
      </div>
    </div>
  );
}
