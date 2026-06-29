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

export const Route = createFileRoute("/station/admin")({
  head: () => ({ meta: [{ title: "Station Admin" }, { name: "robots", content: "noindex" }] }),
  component: StationAdminPage,
});

function StationAdminPage() {
  const sessionFn = useServerFn(getStationSession);
  const hostFn = useServerFn(getHostContext);

  const session = useQuery({ queryKey: ["station-session"], queryFn: () => sessionFn() });
  const host = useQuery({ queryKey: ["host-context"], queryFn: () => hostFn() });

  if (session.isLoading || host.isLoading) {
    return <Shell><p className="text-sm text-muted-foreground">Loading…</p></Shell>;
  }

  if (!session.data?.authenticated) {
    return <LoginForm site={host.data?.site ?? null} />;
  }

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
      <div className="mx-auto max-w-3xl p-6 md:p-10">{children}</div>
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
          Enter the email on file for this station. We'll send you a one-time sign-in link — no password needed.
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
          className="mt-6 space-y-3"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={mut.isPending || !email}
            className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {mut.isPending ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
        <p className="mt-4 text-[11px] text-muted-foreground">
          Links expire after 15 minutes and can only be used once.
        </p>
      </div>
    </Shell>
  );
}

function Dashboard({ session }: { session: any }) {
  const active = session.activeSite;
  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black text-primary">
            {active ? active.display_name : "My stations"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">Signed in as {session.email}</p>
        </div>
        <SignOutButton />
      </div>

      {active ? (
        <>
          <div className="mt-6 rounded-lg border bg-card p-5">
            <h2 className="font-semibold text-primary">Newsroom</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Your station lives at{" "}
              <a href={`https://wkna49.com/network/${active.subdomain}`} className="font-mono text-primary underline">
                wkna49.com/network/{active.subdomain}
              </a>
              . By default it mirrors the WKNA 49 master newsroom &mdash; toggle that off below or hide individual stories.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DashTile title="Posts" hint="Drafts, scheduled and published articles" disabled />
              <DashTile title="Comments" hint="Moderate reader replies" disabled />
              <DashTile title="Branding" hint="Logo, colors, alert bar" disabled />
              <DashTile title="Billing" hint="Update card, invoices" />
            </div>
          </div>

          <NetworkSyncPanel site={active} />
          <NetworkPostsPanel site={active} />
        </>
      ) : (
        <div className="mt-6 space-y-3">
          {(session.sites ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No stations are linked to this email.</p>
          )}
          {(session.sites ?? []).map((s: any) => (
            <a key={s.id} href={`/network/${s.subdomain}/admin`}
               className="block rounded-lg border bg-card p-4 hover:border-primary">
              <div className="font-semibold text-primary">{s.display_name}</div>
              <div className="font-mono text-xs text-muted-foreground">network.wkna49.com/{s.subdomain}</div>
            </a>
          ))}
        </div>
      )}
    </Shell>
  );
}

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
    <div className="mt-4 rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-primary">Network sync</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            When on, your homepage and news feed include published stories from the WKNA 49 master newsroom. Turn off
            to show only your own content.
          </p>
        </div>
        <button
          onClick={() => mut.mutate(!enabled)}
          disabled={mut.isPending}
          className={`h-9 shrink-0 rounded-md px-3 text-xs font-semibold ${
            enabled ? "bg-primary text-primary-foreground" : "border"
          }`}
        >
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
    <div className="mt-4 rounded-lg border bg-card p-5">
      <h2 className="font-semibold text-primary">Network posts</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Hide individual master stories from your station. Hidden posts stay live on WKNA 49 and other stations.
      </p>
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
            <button
              onClick={() => toggle.mutate({ postId: p.id, hidden: p.hidden })}
              disabled={toggle.isPending}
              className="h-8 shrink-0 rounded-md border px-2 text-[11px] font-semibold"
            >
              {p.hidden ? "Unhide" : "Hide"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DashTile({ title, hint, disabled }: { title: string; hint: string; disabled?: boolean }) {
  return (
    <div className={`rounded-md border p-3 text-sm ${disabled ? "opacity-60" : "hover:border-primary cursor-pointer"}`}>
      <div className="font-semibold">{title}{disabled && <span className="ml-1 text-[10px] uppercase text-muted-foreground">(soon)</span>}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
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
