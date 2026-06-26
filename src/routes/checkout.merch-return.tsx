import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";

export const Route = createFileRoute("/checkout/merch-return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({ meta: [{ title: "Order confirmed — WKNA 49 Merch" }] }),
  component: MerchReturn,
  errorComponent: () => <Layout><div className="p-12 text-center">Something went wrong.</div></Layout>,
  notFoundComponent: () => <Layout><div className="p-12 text-center">Not found.</div></Layout>,
});

function MerchReturn() {
  const { session_id } = Route.useSearch();
  return (
    <Layout>
      <PageHeader
        eyebrow="Thanks for supporting WKNA 49"
        title="Your order is in."
        description="We've received your merch order and a confirmation is on its way to your inbox. Items are printed on demand and typically ship within 5–7 business days."
      />
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-4">
        {session_id ? (
          <p className="text-sm text-muted-foreground">
            Order reference: <code className="rounded bg-muted px-2 py-1">{session_id}</code>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No order information found in this URL.</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Link to="/merch" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Keep shopping
          </Link>
          <Link to="/" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold">
            Back to the newsroom
          </Link>
        </div>
      </div>
    </Layout>
  );
}
