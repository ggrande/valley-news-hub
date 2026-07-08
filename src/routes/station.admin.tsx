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
  getStationDomain,
  setStationCustomDomain,
  clearStationCustomDomain,
  verifyStationCustomDomain,
  uploadStationMedia,
  listStationMedia,
  deleteStationMedia,
} from "@/lib/station-admin.functions";


export const Route = createFileRoute("/station/admin")({
  head: () => ({ meta: [{ title: "Station Admin" }, { name: "robots", content: "noindex" }] }),
  component: StationAdminPage,
});

type Tab = "dashboard" | "posts" | "comments" | "branding" | "media" | "domain" | "billing" | "network";

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
    { id: "media", label: "Media" },
    { id: "domain", label: "Domain" },
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
        {tab === "domain" && <DomainTab site={active} />}
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

function renderMarkdown(md: string): string {
  // Tiny, safe subset — enough for a live preview without a heavy dep.
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any
  )[c]);
  let out = esc(md);
  out = out.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  out = out.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  out = out.replace(/^# (.*)$/gm, "<h1>$1</h1>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/\[([^\]]+)\]\((https?:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  out = out
    .split(/\n{2,}/)
    .map((p) => (/^<h[1-6]>/.test(p) ? p : `<p>${p.replace(/\n/g, "<br/>")}</p>`))
    .join("\n");
  return out;
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
  const [preview, setPreview] = useState(false);
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

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const readingMin = Math.max(1, Math.round(wordCount / 220));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-primary">{postId ? "Edit post" : "New post"}</h2>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-primary">← Back</button>
      </div>
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140}
                 className="w-full rounded-md border px-3 py-2 text-sm" />
          <div className="mt-1 text-[10px] text-muted-foreground">{title.length}/140 characters</div>
        </Field>
        <Field label="Slug (optional — auto from title)">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto"
                 className="w-full rounded-md border px-3 py-2 font-mono text-xs" />
        </Field>
        <Field label="Cover image URL">
          <input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…"
                 className="w-full rounded-md border px-3 py-2 text-sm" />
          {cover && (
            <img src={cover} alt="" className="mt-2 max-h-40 rounded-md border object-cover"
                 onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
          )}
        </Field>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Body (markdown supported)
            </label>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>{wordCount} words · ~{readingMin} min read</span>
              <button type="button" onClick={() => setPreview((p) => !p)}
                      className="rounded border px-2 py-0.5 text-[10px] font-semibold">
                {preview ? "Edit" : "Preview"}
              </button>
            </div>
          </div>
          {preview ? (
            <div className="prose prose-sm max-w-none rounded-md border bg-background p-3 text-sm"
                 dangerouslySetInnerHTML={{ __html: renderMarkdown(body) || "<p><em>Nothing to preview yet.</em></p>" }} />
          ) : (
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16}
                      className="w-full rounded-md border px-3 py-2 font-mono text-xs" />
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published (visible on your public site immediately)
        </label>
        <div className="flex gap-2 pt-2">
          <button onClick={() => save.mutate()} disabled={save.isPending || !title}
                  className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {save.isPending ? "Saving…" : published ? "Save & publish" : "Save draft"}
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
  const [zip, setZip] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loaded, setLoaded] = useState(false);
  if (q.data && !loaded) {
    setName(q.data.displayName); setTagline(q.data.tagline);
    setLogo(q.data.logoUrl); setWebsite(q.data.websiteUrl);
    setZip((q.data as any).zipCode ?? "");
    setEmail((q.data as any).contactEmail ?? "");
    setPhone((q.data as any).contactPhone ?? "");
    setLoaded(true);
  }
  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      siteId: site.id, displayName: name, tagline, logoUrl: logo, websiteUrl: website,
      zipCode: zip, contactEmail: email, contactPhone: phone,
    } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["station-branding", site.id] });
      qc.invalidateQueries({ queryKey: ["station-session"] });
      alert(zip && !r?.resolved ? "Saved (zip not recognized — weather will use a fallback)" : "Saved");
    },
    onError: (e: Error) => alert(e.message),
  });
  const city = (q.data as any)?.city as string | undefined;
  const region = (q.data as any)?.region as string | undefined;
  return (
    <div className="max-w-xl space-y-3 rounded-lg border bg-card p-4">
      <h2 className="font-semibold text-primary">Branding & Location</h2>
      <Field label="Station name">
        <input value={name} onChange={(e) => setName(e.target.value)}
               className="w-full rounded-md border px-3 py-2 text-sm" />
      </Field>
      <Field label="Tagline">
        <input value={tagline} onChange={(e) => setTagline(e.target.value)}
               className="w-full rounded-md border px-3 py-2 text-sm" />
      </Field>
      <Field label="ZIP code (powers the local weather page)">
        <input value={zip} onChange={(e) => setZip(e.target.value)} inputMode="numeric"
               maxLength={5} placeholder="25301"
               className="w-full rounded-md border px-3 py-2 text-sm" />
        {city && region && (
          <p className="mt-1 text-xs text-muted-foreground">Resolved: {city}, {region}</p>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="news@station.com"
                 className="w-full rounded-md border px-3 py-2 text-sm" />
        </Field>
        <Field label="Contact phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-1234"
                 className="w-full rounded-md border px-3 py-2 text-sm" />
        </Field>
      </div>
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
        {save.isPending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}


// ---------- BILLING ----------
function BillingTab({ site }: { site: any }) {
  const getFn = useServerFn(getStationBilling);
  const portalFn = useServerFn(createStationBillingPortal);
  const q = useQuery({
    queryKey: ["station-billing", site.id],
    queryFn: () => getFn({ data: { siteId: site.id } }),
  });
  const open = useMutation({
    mutationFn: () => portalFn({ data: {
      siteId: site.id,
      returnUrl: typeof window !== "undefined" ? window.location.href : "https://wkna49.com/station/admin",
    } }),
    onSuccess: (r: any) => {
      if ("error" in r) { alert(r.error); return; }
      window.open(r.url, "_blank", "noopener");
    },
    onError: (e: Error) => alert(e.message),
  });

  if (q.isLoading) return <p className="text-xs text-muted-foreground">Loading billing…</p>;
  const b = q.data;
  if (!b?.hasBilling) {
    return (
      <div className="max-w-xl rounded-lg border bg-card p-5">
        <h2 className="font-semibold text-primary">Billing</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No Stripe purchase is linked to this station yet. If you just checked out, this page will populate within a minute.
        </p>
      </div>
    );
  }
  const fmt = (cents: number | null, cur: string | null) =>
    cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: (cur || "usd").toUpperCase() })
      .format(cents / 100);

  return (
    <div className="max-w-xl space-y-3 rounded-lg border bg-card p-5">
      <h2 className="font-semibold text-primary">Billing</h2>
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Plan</dt>
        <dd className="font-semibold capitalize">{b.tier.replace(/_/g, " ")}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd className="font-semibold capitalize">{b.status}</dd>
        <dt className="text-muted-foreground">Last charge</dt>
        <dd>{fmt(b.amountCents, b.currency)}</dd>
        <dt className="text-muted-foreground">Environment</dt>
        <dd className="capitalize">{b.environment}</dd>
        <dt className="text-muted-foreground">Since</dt>
        <dd>{(b.since ?? "").slice(0, 10) || "—"}</dd>
      </dl>
      <div className="pt-2">
        <button onClick={() => open.mutate()} disabled={open.isPending || !b.hasCustomer}
                className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {open.isPending ? "Opening…" : b.hasSubscription ? "Manage subscription" : "Open billing portal"}
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Opens Stripe's secure billing portal in a new tab — update payment method, download invoices, or cancel.
        </p>
      </div>
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

// ---------- CUSTOM DOMAIN ----------
function DomainTab({ site }: { site: any }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getStationDomain);
  const setFn = useServerFn(setStationCustomDomain);
  const clearFn = useServerFn(clearStationCustomDomain);
  const verifyFn = useServerFn(verifyStationCustomDomain);
  const q = useQuery({
    queryKey: ["station-domain", site.id],
    queryFn: () => getFn({ data: { siteId: site.id } }),
  });
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  if (q.data && !loaded) {
    setInput(q.data.customDomain ?? "");
    setLoaded(true);
  }
  const invalidate = () => qc.invalidateQueries({ queryKey: ["station-domain", site.id] });
  const attach = useMutation({
    mutationFn: () => setFn({ data: { siteId: site.id, domain: input } }),
    onSuccess: invalidate,
    onError: (e: Error) => alert(e.message),
  });
  const verify = useMutation({
    mutationFn: () => verifyFn({ data: { siteId: site.id } }),
    onSuccess: (r: any) => {
      invalidate();
      if (r.ok) alert("Verified — your custom domain is live.");
      else alert(r.error || "DNS not ready yet. Give it a few minutes.");
    },
    onError: (e: Error) => alert(e.message),
  });
  const detach = useMutation({
    mutationFn: () => clearFn({ data: { siteId: site.id } }),
    onSuccess: () => { setLoaded(false); invalidate(); },
    onError: (e: Error) => alert(e.message),
  });

  const status = q.data?.status ?? "unset";
  const badge = (() => {
    const map: Record<string, string> = {
      unset: "bg-muted text-muted-foreground",
      pending: "bg-amber-100 text-amber-900",
      failed: "bg-destructive/10 text-destructive",
      verified: "bg-emerald-100 text-emerald-900",
    };
    const label: Record<string, string> = {
      unset: "No domain",
      pending: "Awaiting DNS",
      failed: "Verification failed",
      verified: "Live",
    };
    return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[status] ?? map.unset}`}>{label[status] ?? status}</span>;
  })();

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-primary">Custom domain</h2>
          {badge}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Point your own domain (e.g. <span className="font-mono">news.example.com</span>) at your station.
          Your default address <span className="font-mono">wkna49.com/network/{site.subdomain}</span> keeps working either way.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <Field label="Domain">
            <input value={input} onChange={(e) => setInput(e.target.value)}
                   placeholder="news.example.com"
                   className="w-72 rounded-md border px-3 py-2 text-sm font-mono" />
          </Field>
          <button onClick={() => attach.mutate()} disabled={attach.isPending || !input}
                  className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {attach.isPending ? "Saving…" : q.data?.customDomain ? "Update" : "Attach"}
          </button>
          {q.data?.customDomain && (
            <button onClick={() => confirm("Remove custom domain?") && detach.mutate()}
                    className="h-10 rounded-md border border-destructive/40 px-3 text-xs font-semibold text-destructive">
              Remove
            </button>
          )}
        </div>
      </div>

      {q.data?.instructions && (
        <div className="rounded-lg border bg-card p-5">
          <h3 className="font-semibold text-primary">DNS records</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Add both of these at your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.). Propagation usually takes 5–30 minutes.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-widest text-muted-foreground">
                <tr><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Name / Host</th><th className="py-2">Value</th></tr>
              </thead>
              <tbody className="font-mono text-[12px]">
                <tr className="border-t"><td className="py-2 pr-3">CNAME</td><td className="py-2 pr-3">{q.data.instructions.cname.name}</td><td className="py-2 break-all">{q.data.instructions.cname.target}</td></tr>
                <tr className="border-t"><td className="py-2 pr-3">TXT</td><td className="py-2 pr-3">{q.data.instructions.txt.name}</td><td className="py-2 break-all">{q.data.instructions.txt.value}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={() => verify.mutate()} disabled={verify.isPending}
                    className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {verify.isPending ? "Checking DNS…" : "Verify now"}
            </button>
            {q.data.lastCheckedAt && (
              <span className="text-[11px] text-muted-foreground">
                Last checked {new Date(q.data.lastCheckedAt).toLocaleString()}
              </span>
            )}
          </div>
          {q.data.lastError && status !== "verified" && (
            <p className="mt-3 rounded-md bg-destructive/10 p-3 text-[12px] text-destructive">{q.data.lastError}</p>
          )}
          {status === "verified" && (
            <p className="mt-3 rounded-md bg-emerald-100 p-3 text-[12px] text-emerald-900">
              Verified — <a href={`https://${q.data.customDomain}`} target="_blank" rel="noreferrer" className="underline">https://{q.data.customDomain}</a> now serves your station.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
