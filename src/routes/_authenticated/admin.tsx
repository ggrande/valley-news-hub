import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — WKNA 49 News" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", exact: true },
  { to: "/admin/posts", label: "Posts" },
  { to: "/admin/reddit", label: "Reddit Intake" },
  { to: "/admin/reddit-automation", label: "Reddit Automation" },
  { to: "/admin/comments", label: "Comments" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/authors", label: "Authors" },
  { to: "/admin/media", label: "Media Library" },
  { to: "/admin/ai-log", label: "AI Log" },
  { to: "/admin/submissions", label: "Submissions" },
  { to: "/admin/closings", label: "Closings & Delays" },
  { to: "/admin/settings", label: "Site Settings" },
];

function AdminLayout() {
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Loading admin…</div>;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="font-display text-2xl font-black text-primary">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account is signed in, but it doesn't have admin privileges. Contact a station administrator.</p>
        <button onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/auth" }))} className="mt-4 h-10 rounded-md border px-4 text-sm font-semibold">Sign out</button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-[color:var(--ivory)]">
      <aside className={`${open ? "block" : "hidden"} md:block w-60 shrink-0 border-r bg-[color:var(--navy-dark)] text-white`}>
        <div className="border-b border-white/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--gold)]">WKNA 49</p>
          <p className="font-display text-lg font-bold">Newsroom Admin</p>
        </div>
        <nav className="p-2">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeProps={{ className: "bg-white/10 text-white" }}
              activeOptions={{ exact: n.exact }}
              className="block rounded px-3 py-2 text-sm text-white/85 hover:bg-white/5"
              onClick={() => setOpen(false)}
            >
              {n.label}
            </Link>
          ))}
          <div className="mt-6 border-t border-white/10 p-2 text-xs text-white/60">
            <p className="truncate">{user?.email}</p>
            <button onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/auth" }))} className="mt-2 w-full rounded border border-white/15 px-2 py-1 text-left hover:bg-white/5">Sign out</button>
            <Link to="/" className="mt-1 block px-2 py-1 hover:text-white">↩ Back to site</Link>
          </div>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3 md:px-6">
          <button className="md:hidden rounded border px-3 py-1 text-sm" onClick={() => setOpen((v) => !v)}>Menu</button>
          <p className="text-sm text-muted-foreground">WKNA 49 Newsroom CMS</p>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
