import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Layout, PageHeader } from "@/components/site/Layout";
import { listMyManagedSites } from "@/lib/managed-sites.functions";
import {
  createNetworkBillingPortalSession,
} from "@/lib/network-payments.functions";
import { listMyLicenses, getMyLicenseDownloadUrl } from "@/lib/network-licenses.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({ meta: [{ title: "Order confirmed — WKNA 49 Network" }] }),
  component: CheckoutReturn,
  errorComponent: () => <Layout><div className="p-12 text-center">Something went wrong.</div></Layout>,
  notFoundComponent: () => <Layout><div className="p-12 text-center">Not found.</div></Layout>,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  const navigate = useNavigate();
  const fetchSites = useServerFn(listMyManagedSites);
  const fetchLicenses = useServerFn(listMyLicenses);
  const openPortalFn = useServerFn(createNetworkBillingPortalSession);
  const getDownloadFn = useServerFn(getMyLicenseDownloadUrl);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Poll for ~60s while the payments webhook creates the managed_sites /
  // licenses row. Stop refetching once we've seen either one.
  const sites = useQuery({
    queryKey: ["my-managed-sites-postcheckout"],
    queryFn: () => fetchSites(),
    retry: false,
    refetchInterval: (q) => ((q.state.data?.length ?? 0) > 0 ? false : 3000),
  });
  const licenses = useQuery({
    queryKey: ["my-licenses-postcheckout"],
    queryFn: () => fetchLicenses(),
    retry: false,
    refetchInterval: (q) => ((q.state.data?.length ?? 0) > 0 ? false : 3000),
  });

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // The freshest managed site (undelivered onboarding) is the one to send
  // the buyer into. If they already have any pending site, auto-redirect.
  const pendingSite = sites.data?.find((s) => !s.onboarding_completed_at);
  useEffect(() => {
    if (pendingSite) {
      navigate({
        to: "/account/managed-sites/$siteId/onboarding",
        params: { siteId: pendingSite.id },
        replace: true,
      });
    }
  }, [pendingSite, navigate]);

  const freshLicense = licenses.data?.[0];

  const portal = useMutation({
    mutationFn: async () => {
      const result = await openPortalFn({
        data: {
          returnUrl: window.location.origin + "/account/managed-sites",
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in result) throw new Error(result.error);
      return result.url;
    },
    onSuccess: (url) => window.open(url, "_blank", "noopener"),
    onError: (e: Error) => setPortalError(e.message),
  });

  const download = useMutation({
    mutationFn: async (licenseId: string) => {
      const result = await getDownloadFn({ data: { licenseId } });
      if (!result?.url) throw new Error("No download URL returned");
      return result.url as string;
    },
    onSuccess: (url) => window.open(url, "_blank", "noopener"),
    onError: (e: Error) => setDlError(e.message),
  });

  const waitingForWebhook =
    !sites.isLoading &&
    !licenses.isLoading &&
    (sites.data?.length ?? 0) === 0 &&
    (licenses.data?.length ?? 0) === 0 &&
    elapsed < 60;

  return (
    <Layout>
      <PageHeader
        eyebrow="Welcome to the network"
        title="You're in."
        description="Your order is confirmed. Continue below — we also emailed a backup copy of your onboarding / license link."
      />
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-6">
        {session_id && (
          <p className="text-sm text-muted-foreground">
            Order reference:{" "}
            <code className="rounded bg-muted px-2 py-1">{session_id}</code>
          </p>
        )}

        {(sites.isLoading || licenses.isLoading || waitingForWebhook) && (
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            <p className="font-semibold">Finalizing your order…</p>
            <p className="mt-1 text-muted-foreground">
              Stripe is delivering the payment confirmation to our server. This usually
              takes a few seconds. You can also open the link we emailed you.
            </p>
          </div>
        )}

        {pendingSite && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-4">
            <p className="text-sm font-semibold">Your managed station is ready to set up.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Redirecting you to onboarding…
            </p>
            <Link
              to="/account/managed-sites/$siteId/onboarding"
              params={{ siteId: pendingSite.id }}
              className="mt-3 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Start onboarding →
            </Link>
          </div>
        )}

        {freshLicense && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-4">
            <p className="text-sm font-semibold">Your self-host license is ready.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              License key:{" "}
              <code className="rounded bg-background px-2 py-1">{freshLicense.license_key}</code>
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => { setDlError(null); download.mutate(freshLicense.id); }}
                disabled={download.isPending}
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {download.isPending ? "Preparing…" : "Download latest release"}
              </button>
              <Link
                to="/account/licenses"
                className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold"
              >
                All licenses
              </Link>
            </div>
            {dlError && <p className="mt-2 text-sm text-[color:var(--breaking)]">{dlError}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to="/account/managed-sites"
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold"
          >
            My Affiliate Stations
          </Link>
          <button
            type="button"
            onClick={() => { setPortalError(null); portal.mutate(); }}
            disabled={portal.isPending}
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold disabled:opacity-60"
          >
            {portal.isPending ? "Opening…" : "Manage billing"}
          </button>
          <Link
            to="/network"
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold"
          >
            Back to Network
          </Link>
        </div>
        {portalError && (
          <p className="text-sm text-[color:var(--breaking)]">{portalError}</p>
        )}
      </div>
    </Layout>
  );
}
