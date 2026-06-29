import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  requestStationLogin,
  getStationSession,
  signOutStation,
  getHostContext,
} from "@/lib/tenant-auth.functions";
import {
  setTenantNetworkSync,
  hideNetworkPost,
  unhideNetworkPost,
  listNetworkPostsForAdmin,
  getTenantBySlug,
} from "@/lib/network-feed.functions";
import {
  getStationStats,
  listStationPosts,
  getStationPost,
  upsertStationPost,
  deleteStationPost,
  listStationComments,
  setStationCommentStatus,
  deleteStationComment,
  getStationBranding,
  updateStationBranding,
  getStationBilling,
  createStationBillingPortal,
} from "@/lib/station-admin.functions";

export const Route = createFileRoute("/station/admin")({
  head: () => ({ meta: [{ title: "Station Admin" }, { name: "robots", content: "noindex" }] }),
  component: StationAdminPage,
});

type Tab = "dashboard" | "posts" | "comments" | "branding" | "billing" | "network";

function StationAdminPage() {
  const sessionFn = useServerFn(getStationSession);
  const hostFn = useServerFn(getHostContext);
  const session = useQuery({ queryKey: ["station-session"], queryFn: () => sessionFn() });
  const host = useQuery({ queryKey: ["host-context"], queryFn: () => hostFn() });

  if (session.isLoading || host.isLoading) {
    return <Shell><p className="text-sm text-muted-foreground">Loading…</p></Shell>;
  }
  if (!session.data?.authenticated) return <LoginForm site={host.data?.site ?? null} />;
  if (session.data.hostBlocked) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-bold text-primary">No access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You're signed in as <strong>{session.data.email}</strong>, but you don't own this station.
        </p>
        <SignOutButton />
      </Shell>
    );
  }
  return <Dashboard session={session.data} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl p-6 md:p-10">{children}</div>
    </div>
  );
}

function LoginForm({ site }: { site: { displayName: string; subdomain: string } | null }) {
  const requestFn = useServerFn(requestStationLogin);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () => requestFn({ data: { email, host: window.location.host } }),
    onSuccess: (r: any) => setSent(r.message),
    onError: (e: Error) => alert(e.message),
  });
  if (sent) {
    return (
      <Shell>
        <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">✉️</div>
          <h1 className="font-display text-xl font-bold text-primary">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">{sent}</p>
          <button onClick={() => setSent(null)} className="mt-4 text-xs text-primary underline">
            Use a different email
          </button>
        </div>
      </Shell>
    );
  }
  return (
    <Shell>
      <div className="mx-auto max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="font-display text-2xl font-black text-primary">
          {site ? `Sign in to ${site.displayName}` : "Station sign-in"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the email on file. We'll send a one-time sign-in link.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="mt-6 space-y-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                 placeholder="you@example.com" required autoFocus
                 className="w-full rounded-md border px-3 py-2 text-sm" />
          <button type="submit" disabled={mut.isPending || !email}
                  className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {mut.isPending ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      </div>
    </Shell>
  );
}

function Dashboard({ session }: { session: any }) {
  const active = session.activeSite;
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!active) {
    return (
      <Shell>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-black text-primary">My stations</h1>
            <p className="mt-1 text-xs text-muted-foreground">Signed in as {session.email}</p>
          </div>
          <SignOutButton />
        </div>
        <div className="mt-6 space-y-3">
          {(session.sites ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No stations are linked to this email.</p>
          )}
          {(session.sites ?? []).map((s: any) => (
            <a key={s.id} href={`/network/${s.subdomain}/admin`}
               className="block rounded-lg border bg-card p-4 hover:border-primary">
              <div className="font-semibold text-primary">{s.display_name}</div>
              <div className="font-mono text-xs text-muted-foreground">wkna49.com/network/{s.subdomain}</div>
            </a>
          ))}
        </div>
      </Shell>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "posts", label: "Posts" },
    { id: "comments", label: "Comments" },
    { id: "branding", label: "Branding" },
    { id: "billing", label: "Billing" },
    { id: "network", label: "Network" },
  ];

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black text-primary">{active.display_name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">Signed in as {session.email}</p>
        </div>
        <SignOutButton />
      </div>

      <div className="mt-6 flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${
                    tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary"
                  }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "dashboard" && <DashboardTab site={active} />}
        {tab === "posts" && <PostsTab site={active} />}
        {tab === "comments" && <CommentsTab site={active} />}
        {tab === "branding" && <BrandingTab site={active} />}
        {tab === "billing" && <BillingTab site={active} />}
        {tab === "network" && (
          <div className="space-y-4">
            <NetworkSyncPanel site={active} />
            <NetworkPostsPanel site={active} />
          </div>
        )}
      </div>
    </Shell>
  );
}

// ---------- DASHBOARD ----------
function DashboardTab({ site }: { site: any }) {
  const statsFn = useServerFn(getStationStats);
  const q = useQuery({
    queryKey: ["station-stats", site.id],
    queryFn: () => statsFn({ data: { siteId: site.id } }),
  });
  const s = q.data;
  const card = (label: string, value: number | string) => (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-black text-primary">{value}</p>
    </div>
  );
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {card("Published posts", s?.published ?? "–")}
        {card("Drafts", s?.drafts ?? "–")}
        {card("Total posts", s?.posts ?? "–")}
        {card("Pending comments", s?.pendingComments ?? "–")}
        {card("Total comments", s?.comments ?? "–")}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Your newsroom: <a className="font-mono text-primary underline"
        href={`https://wkna49.com/network/${site.subdomain}`}>wkna49.com/network/{site.subdomain}</a>
      </p>
    </div>
  );
}

// ---------- POSTS ----------
function PostsTab({ site }: { site: any }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listStationPosts);
  const delFn = useServerFn(deleteStationPost);
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const q = useQuery({
    queryKey: ["station-posts", site.id],
    queryFn: () => listFn({ data: { siteId: site.id } }),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { siteId: site.id, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["station-posts", site.id] }),
    onError: (e: Error) => alert(e.message),
  });
  if (editing) {
    return <PostEditor site={site} postId={editing.id} onClose={() => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["station-posts", site.id] });
    }} />;
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-primary">Posts</h2>
        <button onClick={() => setEditing({})}
                className="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">
          New post
        </button>
      </div>
      {q.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {q.error && <p className="text-xs text-destructive">{(q.error as Error).message}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {(q.data?.posts ?? []).map((p: any) => (
          <li key={p.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-primary">{p.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {p.published ? "Published" : "Draft"} · /{p.slug} · updated {(p.updated_at ?? "").slice(0, 10)}
              </div>
            </div>
            <button onClick={() => setEditing({ id: p.id })} className="h-8 rounded-md border px-2 text-[11px] font-semibold">Edit</button>
            <button onClick={() => confirm(`Delete "${p.title}"?`) && del.mutate(p.id)}
                    className="h-8 rounded-md border border-destructive/40 px-2 text-[11px] font-semibold text-destructive">
              Delete
            </button>
          </li>
        ))}
        {(q.data?.posts ?? []).length === 0 && !q.isLoading && (
          <li className="p-6 text-center text-xs text-muted-foreground">No posts yet. Create your first one.</li>
        )}
      </ul>
    </div>
  );
}

function PostEditor({ site, postId, onClose }: { site: any; postId?: string; onClose: () => void }) {
  const getFn = useServerFn(getStationPost);
  const upsertFn = useServerFn(upsertStationPost);
  const existing = useQuery({
    queryKey: ["station-post", site.id, postId],
    queryFn: () => getFn({ data: { siteId: site.id, id: postId! } }),
    enabled: !!postId,
  });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cover, setCover] = useState("");
  const [slug, setSlug] = useState("");
  const [published, setPublished] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (postId && existing.data?.post && !loaded) {
    const p = existing.data.post;
    setTitle(p.title ?? ""); setBody(p.body ?? ""); setCover(p.cover_url ?? "");
    setSlug(p.slug ?? ""); setPublished(!!p.published); setLoaded(true);
  }

  const save = useMutation({
    mutationFn: () => upsertFn({ data: {
      siteId: site.id, id: postId, title, body, cover_url: cover || null,
      slug: slug || undefined, published,
    } }),
    onSuccess: () => onClose(),
    onError: (e: Error) => alert(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-primary">{postId ? "Edit post" : "New post"}</h2>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-primary">← Back</button>
      </div>
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
                 className="w-full rounded-md border px-3 py-2 text-sm" />
        </Field>
        <Field label="Slug (optional — auto from title)">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto"
                 className="w-full rounded-md border px-3 py-2 font-mono text-xs" />
        </Field>
        <Field label="Cover image URL">
          <input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…"
                 className="w-full rounded-md border px-3 py-2 text-sm" />
        </Field>
        <Field label="Body (markdown supported)">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14}
                    className="w-full rounded-md border px-3 py-2 font-mono text-xs" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published
        </label>
        <div className="flex gap-2 pt-2">
          <button onClick={() => save.mutate()} disabled={save.isPending || !title}
                  className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {save.isPending ? "Saving…" : "Save"}
          </button>
          <button onClick={onClose} className="h-10 rounded-md border px-4 text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------- COMMENTS ----------
function CommentsTab({ site }: { site: any }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listStationComments);
  const setFn = useServerFn(setStationCommentStatus);
  const delFn = useServerFn(deleteStationComment);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const q = useQuery({
    queryKey: ["station-comments", site.id, filter],
    queryFn: () => listFn({ data: { siteId: site.id, status: filter } }),
  });
  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" }) =>
      setFn({ data: { siteId: site.id, id: v.id, status: v.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["station-comments", site.id] }),
    onError: (e: Error) => alert(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { siteId: site.id, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["station-comments", site.id] }),
    onError: (e: Error) => alert(e.message),
  });
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-primary">Comments</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)}
                className="rounded-md border px-2 py-1 text-xs">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="all">All</option>
        </select>
      </div>
      {q.data?.missingTable && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Your tenant database doesn't have a comments table yet. New stations get one automatically; existing ones can re-apply the schema on next platform update.
        </div>
      )}
      <ul className="divide-y rounded-lg border bg-card">
        {(q.data?.comments ?? []).map((c: any) => (
          <li key={c.id} className="space-y-2 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-primary">{c.author_name ?? "Anonymous"}</span> ·{" "}
                <span className="capitalize">{c.status}</span> · {(c.created_at ?? "").slice(0, 16).replace("T", " ")}
              </div>
              <div className="flex gap-1">
                {c.status !== "approved" && (
                  <button onClick={() => setStatus.mutate({ id: c.id, status: "approved" })}
                          className="h-7 rounded border px-2 text-[11px]">Approve</button>
                )}
                {c.status !== "rejected" && (
                  <button onClick={() => setStatus.mutate({ id: c.id, status: "rejected" })}
                          className="h-7 rounded border px-2 text-[11px]">Reject</button>
                )}
                <button onClick={() => confirm("Delete this comment?") && del.mutate(c.id)}
                        className="h-7 rounded border border-destructive/40 px-2 text-[11px] text-destructive">Delete</button>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm">{c.body}</p>
          </li>
        ))}
        {(q.data?.comments ?? []).length === 0 && !q.isLoading && !q.data?.missingTable && (
          <li className="p-6 text-center text-xs text-muted-foreground">No comments in this view.</li>
        )}
      </ul>
    </div>
  );
}

// ---------- BRANDING ----------
function BrandingTab({ site }: { site: any }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getStationBranding);
  const saveFn = useServerFn(updateStationBranding);
  const q = useQuery({
    queryKey: ["station-branding", site.id],
    queryFn: () => getFn({ data: { siteId: site.id } }),
  });
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logo, setLogo] = useState("");
  const [website, setWebsite] = useState("");
  const [loaded, setLoaded] = useState(false);
  if (q.data && !loaded) {
    setName(q.data.displayName); setTagline(q.data.tagline);
    setLogo(q.data.logoUrl); setWebsite(q.data.websiteUrl); setLoaded(true);
  }
  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      siteId: site.id, displayName: name, tagline, logoUrl: logo, websiteUrl: website,
    } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["station-branding", site.id] });
      qc.invalidateQueries({ queryKey: ["station-session"] });
      alert("Saved");
    },
    onError: (e: Error) => alert(e.message),
  });
  return (
    <div className="max-w-xl space-y-3 rounded-lg border bg-card p-4">
      <h2 className="font-semibold text-primary">Branding</h2>
      <Field label="Station name">
        <input value={name} onChange={(e) => setName(e.target.value)}
               className="w-full rounded-md border px-3 py-2 text-sm" />
      </Field>
      <Field label="Tagline">
        <input value={tagline} onChange={(e) => setTagline(e.target.value)}
               className="w-full rounded-md border px-3 py-2 text-sm" />
      </Field>
      <Field label="Logo URL">
        <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…"
               className="w-full rounded-md border px-3 py-2 text-sm" />
        {logo && <img src={logo} alt="" className="mt-2 h-16 w-auto rounded border" />}
      </Field>
      <Field label="Website URL (where visitors go)">
        <input value={website} onChange={(e) => setWebsite(e.target.value)}
               placeholder={`https://wkna49.com/network/${q.data?.subdomain ?? ""}`}
               className="w-full rounded-md border px-3 py-2 text-sm" />
      </Field>
      <button onClick={() => save.mutate()} disabled={save.isPending || !name}
              className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {save.isPending ? "Saving…" : "Save branding"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

// ---------- NETWORK (existing) ----------
function NetworkSyncPanel({ site }: { site: any }) {
  const qc = useQueryClient();
  const setSyncFn = useServerFn(setTenantNetworkSync);
  const tenantFn = useServerFn(getTenantBySlug);
  const q = useQuery({
    queryKey: ["tenant-slug", site.subdomain],
    queryFn: () => tenantFn({ data: { slug: site.subdomain } }),
  });
  const enabled = q.data?.networkSyncEnabled ?? true;
  const mut = useMutation({
    mutationFn: (next: boolean) => setSyncFn({ data: { siteId: site.id, enabled: next } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant-slug", site.subdomain] }),
    onError: (e: Error) => alert(e.message),
  });
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-primary">Network sync</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            When on, your homepage and news feed mirror published stories from WKNA 49.
          </p>
        </div>
        <button onClick={() => mut.mutate(!enabled)} disabled={mut.isPending}
                className={`h-9 shrink-0 rounded-md px-3 text-xs font-semibold ${
                  enabled ? "bg-primary text-primary-foreground" : "border"
                }`}>
          {mut.isPending ? "Saving…" : enabled ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
}

function NetworkPostsPanel({ site }: { site: any }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listNetworkPostsForAdmin);
  const hideFn = useServerFn(hideNetworkPost);
  const unhideFn = useServerFn(unhideNetworkPost);
  const q = useQuery({
    queryKey: ["network-posts-admin", site.id],
    queryFn: () => listFn({ data: { siteId: site.id, limit: 50 } }),
  });
  const toggle = useMutation({
    mutationFn: (p: { postId: string; hidden: boolean }) =>
      p.hidden
        ? unhideFn({ data: { siteId: site.id, postId: p.postId } })
        : hideFn({ data: { siteId: site.id, postId: p.postId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["network-posts-admin", site.id] }),
    onError: (e: Error) => alert(e.message),
  });
  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="font-semibold text-primary">Network posts</h2>
      <p className="mt-1 text-xs text-muted-foreground">Hide master stories from your station.</p>
      {q.isLoading && <p className="mt-3 text-xs text-muted-foreground">Loading…</p>}
      <ul className="mt-3 divide-y">
        {(q.data?.posts ?? []).map((p: any) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm ${p.hidden ? "text-muted-foreground line-through" : "text-primary"}`}>
                {p.title}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {p.category ?? "News"} · {(p.published_at ?? "").slice(0, 10)}
              </div>
            </div>
            <button onClick={() => toggle.mutate({ postId: p.id, hidden: p.hidden })}
                    disabled={toggle.isPending}
                    className="h-8 shrink-0 rounded-md border px-2 text-[11px] font-semibold">
              {p.hidden ? "Unhide" : "Hide"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignOutButton() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOutFn = useServerFn(signOutStation);
  const mut = useMutation({
    mutationFn: () => signOutFn(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["station-session"] });
      navigate({ to: "/station/admin" });
    },
  });
  return (
    <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="h-9 rounded-md border px-3 text-xs font-semibold">
      {mut.isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
