import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Layout, PageHeader } from "@/components/site/Layout";
import { listMyManagedSites } from "@/lib/managed-sites.functions";
import { createNetworkBillingPortalSession } from "@/lib/network-payments.functions";
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
  const openPortalFn = useServerFn(createNetworkBillingPortalSession);
  const [portalError, setPortalError] = useState<string | null>(null);

  const sites = useQuery({
    queryKey: ["my-managed-sites-postcheckout"],
    queryFn: () => fetchSites(),
    retry: false,
  });

  useEffect(() => {
    const pending = sites.data?.find((s) => !s.onboarding_completed_at);
    if (pending) {
      navigate({
        to: "/account/managed-sites/$siteId/onboarding",
        params: { siteId: pending.id },
        replace: true,
      });
    }
  }, [sites.data, navigate]);

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

  return (
    <Layout>
      <PageHeader
        eyebrow="Welcome to the network"
        title="You're in."
        description="We've received your order. Check your email for your license key (self-host) or onboarding link (managed mirror)."
      />
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-4">
        {session_id ? (
          <p className="text-sm text-muted-foreground">
            Order reference:{" "}
            <code className="rounded bg-muted px-2 py-1">{session_id}</code>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No order information found in this URL.</p>
        )}
        {sites.isLoading && (
          <p className="text-sm text-muted-foreground">Looking up your station…</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/account/managed-sites"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            My Affiliate Stations
          </Link>
          <Link
            to="/account/licenses"
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold"
          >
            View my licenses
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
