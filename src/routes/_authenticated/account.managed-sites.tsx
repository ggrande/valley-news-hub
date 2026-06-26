import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listMyManagedSites,
  updateManagedSiteSettings,
  acceptPendingRelease,
  rejectPendingRelease,
  type ManagedSiteRow,
} from "@/lib/managed-sites.functions";
import { createNetworkBillingPortalSession } from "@/lib/network-payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/_authenticated/account/managed-sites")({
  head: () => ({ meta: [{ title: "My Affiliate Stations — WKNA 49 Affiliate Network" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const list = useServerFn(listMyManagedSites);
  const portal = useServerFn(createNetworkBillingPortalSession);
  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["my-managed-sites"],
    queryFn: () => list(),
  });

  const portalMut = useMutation({
    mutationFn: async () => {
      const r = await portal({ data: { returnUrl: window.location.href, environment: getStripeEnvironment() } });
      if ("error" in r) throw new Error(r.error);
      window.open(r.url, "_blank", "noopener");
    },
    onError: (e: any) => alert(e.message || "Could not open billing portal"),
  });


  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black text-primary">My Managed Sites</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your hosted WKNA Network sites — review pending updates, customize branding, and set your custom domain.
          </p>
        </div>
        {sites.length > 0 && (
          <button
            onClick={() => portalMut.mutate()}
            disabled={portalMut.isPending}
            className="h-9 rounded-md border px-4 text-sm font-semibold disabled:opacity-50"
          >
            {portalMut.isPending ? "Opening…" : "Manage billing"}
          </button>
        )}
      </div>


      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : sites.length === 0 ? (
        <div className="mt-8 rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">You don't have any managed sites yet.</p>
          <a href="/network" className="mt-3 inline-block text-sm font-semibold text-primary underline">
            Start a Managed Mirror subscription →
          </a>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {sites.map((s) => <SiteCard key={s.id} site={s} />)}
        </div>
      )}
    </div>
  );
}

function SiteCard({ site }: { site: ManagedSiteRow }) {
  const qc = useQueryClient();
  const update = useServerFn(updateManagedSiteSettings);
  const accept = useServerFn(acceptPendingRelease);
  const reject = useServerFn(rejectPendingRelease);

  const [name, setName] = useState(site.display_name);
  const [domain, setDomain] = useState(site.custom_domain ?? "");
  const [autoSec, setAutoSec] = useState(site.auto_apply_security);

  const saveMut = useMutation({
    mutationFn: () =>
      update({ data: { siteId: site.id, display_name: name, custom_domain: domain || null, auto_apply_security: autoSec } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-managed-sites"] }),
  });
  const acceptMut = useMutation({
    mutationFn: () => accept({ data: { siteId: site.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-managed-sites"] }),
  });
  const rejectMut = useMutation({
    mutationFn: () => reject({ data: { siteId: site.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-managed-sites"] }),
  });

  const subActive = site.subscription_status === "active" || site.subscription_status === "trialing";

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-primary">{site.display_name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-mono">{site.subdomain}.wkna49network.com</span>
            {site.custom_domain && <> · custom: <span className="font-mono">{site.custom_domain}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge tone={subActive ? "ok" : "warn"}>{site.subscription_status}</Badge>
          <Badge tone={site.status === "active" ? "ok" : "muted"}>{site.status}</Badge>
        </div>
      </div>

      {site.subscription_status === "past_due" && (
        <div className="mt-4 rounded-md border-2 border-red-400 bg-red-50 p-4 text-sm text-red-900">
          <strong>Your last payment failed.</strong> Update your card via "Manage billing" to keep your site online. Stripe will retry automatically.
        </div>
      )}
      {site.status === "pending_provision" && (
        <div className="mt-4 rounded-md border bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Setting up your site.</strong> Our team is provisioning your hosting. You'll get an email when it's live (usually within 1 business day).
        </div>
      )}

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>Current version: <span className="font-mono text-foreground">{site.current_release?.version ?? "—"}</span></div>
        <div>Last deployed: <span className="text-foreground">{site.last_deployed_at ? new Date(site.last_deployed_at).toLocaleString() : "—"}</span></div>
      </div>


      {site.pending_release && (
        <div className="mt-4 rounded-md border-2 border-[color:var(--breaking)] bg-[color:var(--breaking)]/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[color:var(--breaking)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Update pending
            </span>
            <span className="font-mono text-sm font-semibold">v{site.pending_release.version}</span>
            {site.pending_release.is_security && <Badge tone="danger">Security</Badge>}
            {site.pending_release.is_breaking && <Badge tone="warn">Breaking</Badge>}
          </div>
          {site.pending_release.notes && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{site.pending_release.notes}</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => acceptMut.mutate()}
              disabled={acceptMut.isPending}
              className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {acceptMut.isPending ? "Deploying…" : "Accept & deploy"}
            </button>
            <button
              onClick={() => rejectMut.mutate()}
              disabled={rejectMut.isPending}
              className="h-9 rounded-md border px-4 text-sm font-semibold"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-semibold text-primary">Site settings</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            <span className="font-semibold">Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
                   className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </label>
          <label className="text-xs">
            <span className="font-semibold">Custom domain</span>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="news.example.com"
                   className="mt-1 w-full rounded border px-3 py-2 text-sm font-mono" />
          </label>
          <label className="flex items-center gap-2 text-xs sm:col-span-2">
            <input type="checkbox" checked={autoSec} onChange={(e) => setAutoSec(e.target.checked)} />
            <span>Automatically apply security releases (recommended)</span>
          </label>
        </div>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="mt-3 h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saveMut.isPending ? "Saving…" : "Save settings"}
        </button>
      </details>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "ok" | "warn" | "danger" | "muted" }) {
  const c = {
    ok: "bg-green-100 text-green-800",
    warn: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    muted: "bg-gray-100 text-gray-700",
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c}`}>{children}</span>;
}
