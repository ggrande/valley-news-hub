import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/site/Layout";
import { listMerchProducts } from "@/lib/merch.functions";

export const Route = createFileRoute("/merch")({
  head: () => ({
    meta: [
      { title: "WKNA 49 Merch — T-shirts, Tumblers, Stickers" },
      { name: "description", content: "Official WKNA 49 News merch. Apparel, drinkware, stickers, and car magnets. Print-on-demand, shipped straight to you." },
      { property: "og:title", content: "WKNA 49 Merch Store" },
      { property: "og:description", content: "Wear the valley. Official WKNA-TV 49 merchandise." },
    ],
  }),
  component: MerchIndex,
  errorComponent: ({ error }) => (
    <Layout><div className="p-12 text-center text-red-600">{error.message}</div></Layout>
  ),
  notFoundComponent: () => <Layout><div className="p-12 text-center">Not found.</div></Layout>,
});

function MerchIndex() {
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ["merch-products"],
    queryFn: () => listMerchProducts(),
  });

  return (
    <Layout>
      <PageHeader
        eyebrow="Shop"
        title="WKNA 49 Merch"
        description="Wear the valley. Every order is printed on demand and shipped within 5–10 business days."
      />
      <section className="mx-auto max-w-7xl px-4 py-10">
        {isLoading && <p className="text-sm text-muted-foreground">Loading merch…</p>}
        {error && <p className="text-sm text-red-600">Couldn't load merch right now. Try again shortly.</p>}
        {!isLoading && !error && products.length === 0 && (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="font-semibold text-primary">No merch listed yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon — designs are on the way.</p>
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <Link
              key={p.id}
              to="/merch/$id"
              params={{ id: String(p.id) }}
              className="group flex flex-col overflow-hidden rounded-xl border bg-card transition hover:shadow-lg"
            >
              <div className="aspect-square overflow-hidden bg-muted">
                {p.thumbnail_url ? (
                  <img
                    src={p.thumbnail_url}
                    alt={p.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-display text-base font-bold text-primary">{p.name}</h3>
                <div className="mt-2 flex items-end justify-between">
                  {p.min_price ? (
                    <p className="text-sm text-muted-foreground">From <span className="font-semibold text-primary">${p.min_price}</span></p>
                  ) : <span />}
                  <span className="text-xs uppercase tracking-wider text-[color:var(--broadcast)] group-hover:underline">Shop →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
