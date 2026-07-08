import { createFileRoute, Link } from "@tanstack/react-router";
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
import { purgeAndResetTenant } from "@/lib/supabase-provisioning.functions";
import { listMyLicenses, getMyLicenseDownloadUrl } from "@/lib/network-licenses.functions";
import { getMyManagedSiteProfile } from "@/lib/affiliate-directory.functions";

export const Route = createFileRoute("/_authenticated/account/managed-sites/")({
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
          <h1 className="font-display text-3xl font-black text-primary">My Affiliate Stations</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your Managed Affiliate Stations — review pending updates, customize branding, and set your custom domain.
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
          <p className="text-sm text-muted-foreground">You're not running an Affiliate Station yet.</p>
          <a href="/network" className="mt-3 inline-block text-sm font-semibold text-primary underline">
            Become a Managed Affiliate Station →
          </a>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {sites.map((s) => <SiteCard key={s.id} site={s} />)}
        </div>
      )}

      <LicensesSection />
    </div>
  );
}

function LicensesSection() {
  const fetchLicenses = useServerFn(listMyLicenses);
  const requestDownload = useServerFn(getMyLicenseDownloadUrl);
  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ["my-licenses"],
    queryFn: () => fetchLicenses(),
  });

  const downloadMut = useMutation({
    mutationFn: (licenseId: string) => requestDownload({ data: { licenseId } }),
    onSuccess: (res: any) => window.open(res.url, "_blank"),
    onError: (e: Error) => alert(e.message),
  });

  if (isLoading || licenses.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="font-display text-xl font-bold text-primary">Self-host Licenses</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        License keys from your self-host purchases. Use these to activate a self-hosted install.
      </p>
      <div className="mt-4 space-y-3">
        {licenses.map((lic) => (
          <div key={lic.id} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-xs break-all">{lic.license_key}</div>
                <div className="mt-1 text-xs text-muted-foreground">{lic.email}</div>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <Badge tone={lic.revoked ? "danger" : "ok"}>{lic.revoked ? "Revoked" : "Active"}</Badge>
                <Badge tone="muted">{lic.channel}</Badge>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div><div className="text-muted-foreground uppercase tracking-wide">Version</div><div className="font-medium">{lic.current_version ?? "—"}</div></div>
              <div><div className="text-muted-foreground uppercase tracking-wide">Downloads</div><div className="font-medium">{lic.downloads_used}/{lic.downloads_max}</div></div>
              <div><div className="text-muted-foreground uppercase tracking-wide">Last check</div><div className="font-medium">{lic.last_check_at ? new Date(lic.last_check_at).toLocaleDateString() : "Never"}</div></div>
              <div><div className="text-muted-foreground uppercase tracking-wide">Issued</div><div className="font-medium">{new Date(lic.created_at).toLocaleDateString()}</div></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(lic.license_key); }}
                className="h-8 rounded-md border px-3 text-xs font-semibold"
              >Copy key</button>
              <button
                onClick={() => downloadMut.mutate(lic.id)}
                disabled={lic.revoked || downloadMut.isPending}
                className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >{downloadMut.isPending ? "Preparing…" : "Download latest"}</button>
              <a href="/network/changelog" className="h-8 inline-flex items-center rounded-md px-3 text-xs font-semibold text-primary underline">Changelog</a>
            </div>
          </div>
        ))}
      </div>
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
  const purge = useServerFn(purgeAndResetTenant);
  const purgeMut = useMutation({
    mutationFn: () => purge({ data: { siteId: site.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-managed-sites"] }),
    onError: (e: Error) => alert(e.message),
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
            <span className="font-mono">wkna49.com/network/{site.subdomain}</span>
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
      {!site.onboarding_completed_at && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-[color:var(--breaking)] bg-[color:var(--breaking)]/5 p-4 text-sm">
          <div>
            <strong className="text-primary">Finish setting up your Affiliate Station.</strong>{" "}
            <span className="text-muted-foreground">
              Take 2 minutes to add your branding and (optionally) list in the public directory.
            </span>
          </div>
          <Link
            to="/account/managed-sites/$siteId/onboarding"
            params={{ siteId: site.id }}
            className="h-9 inline-flex items-center rounded-md bg-[color:var(--breaking)] px-4 text-sm font-bold text-white"
          >
            Start onboarding →
          </Link>
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
            {site.pending_release.security && <Badge tone="danger">Security</Badge>}
            {site.pending_release.breaking && <Badge tone="warn">Breaking</Badge>}
          </div>
          {site.pending_release.changelog_md && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{site.pending_release.changelog_md}</p>
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

      {site.onboarding_completed_at && <ReadinessChecklist site={site} />}

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

        <div className="mt-6 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          <div className="font-semibold">Danger zone</div>
          <p className="mt-1">
            Full reset deletes any orphan Supabase projects this station created and returns the wizard to the beginning. Other stations are never touched.
          </p>
          <button
            onClick={() => {
              if (confirm(`Full reset "${site.display_name}"? Orphan Supabase projects from previous attempts will be deleted.`)) {
                purgeMut.mutate();
              }
            }}
            disabled={purgeMut.isPending}
            className="mt-2 h-8 rounded-md border border-red-400 bg-white px-3 text-xs font-semibold text-red-700 disabled:opacity-50"
          >
            {purgeMut.isPending ? "Resetting…" : "Full reset"}
          </button>
        </div>
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

function ReadinessChecklist({ site }: { site: ManagedSiteRow }) {
  const fetchProfile = useServerFn(getMyManagedSiteProfile);
  const { data: profile } = useQuery({
    queryKey: ["managed-site-profile", site.id],
    queryFn: () => fetchProfile({ data: { siteId: site.id } }),
  });

  const items: { label: string; done: boolean; hint?: string; href?: string }[] = [
    { label: "Onboarding wizard finished", done: !!site.onboarding_completed_at },
    {
      label: "Logo & tagline set",
      done: !!(profile?.directory_logo_url && profile?.directory_tagline?.trim()),
      hint: "Adds visual identity to your station page and directory listing.",
    },
    {
      label: "Location (city + region) set",
      done: !!(profile?.directory_city?.trim() && profile?.directory_region?.trim()),
      hint: "Helps readers find your local coverage.",
    },
    {
      label: "Custom domain verified",
      done: !!site.custom_domain && site.custom_domain_status === "verified",
      hint: site.custom_domain
        ? `Current status: ${site.custom_domain_status ?? "unknown"}.`
        : "Optional — a custom domain builds trust and boosts SEO.",
    },
    {
      label: "Listed in the public directory",
      done: !!profile?.directory_opt_in,
      hint: "Let network readers discover your station from the network page.",
    },
    {
      label: "Auto-apply security updates",
      done: site.auto_apply_security,
      hint: "Recommended — keeps your station patched against vulnerabilities without action from you.",
    },
  ];

  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);
  const complete = done === items.length;

  return (
    <details className="mt-4 rounded-md border bg-muted/40 p-4" open={!complete}>
      <summary className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-sm font-semibold text-primary">
          Station readiness · {done}/{items.length}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
            <span
              className={`block h-full ${complete ? "bg-emerald-500" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </span>
          <Badge tone={complete ? "ok" : "warn"}>{complete ? "Ready" : `${pct}%`}</Badge>
        </span>
      </summary>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((i, ix) => (
          <li key={ix} className="flex items-start gap-2">
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                i.done ? "bg-emerald-500 text-white" : "border border-muted-foreground/40 text-muted-foreground"
              }`}
            >
              {i.done ? "✓" : ""}
            </span>
            <div className="min-w-0">
              <div className={i.done ? "text-foreground" : "font-medium text-foreground"}>{i.label}</div>
              {!i.done && i.hint && (
                <div className="text-xs text-muted-foreground">{i.hint}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!complete && (
        <Link
          to="/account/managed-sites/$siteId/onboarding"
          params={{ siteId: site.id }}
          className="mt-3 inline-flex h-8 items-center rounded-md border px-3 text-xs font-semibold text-primary hover:bg-white"
        >
          Revisit setup wizard →
        </Link>
      )}
    </details>
  );
}
