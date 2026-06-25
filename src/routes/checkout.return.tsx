import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";

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
  return (
    <Layout>
      <PageHeader eyebrow="Welcome to the network" title="You're in." description="We've received your order. Check your email for your license key (self-host) or onboarding link (managed mirror)." />
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-4">
        {session_id ? (
          <p className="text-sm text-muted-foreground">Order reference: <code className="rounded bg-muted px-2 py-1">{session_id}</code></p>
        ) : (
          <p className="text-sm text-muted-foreground">No order information found in this URL.</p>
        )}
        <div className="flex gap-3">
          <Link to="/network" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Back to Network</Link>
          <Link to="/network/changelog" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold">View changelog</Link>
        </div>
      </div>
    </Layout>
  );
}
