import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/site/Layout";
import { listMerchProducts } from "@/lib/merch.functions";
import { supabase } from "@/integrations/supabase/client";

type MerchSettings = {
  eyebrow: string;
  title: string;
  description: string;
  product_order: number[];
};

const DEFAULT_SETTINGS: MerchSettings = {
  eyebrow: "Shop",
  title: "WKNA 49 Merch",
  description: "Wear the valley. Every order is printed on demand and shipped within 5–10 business days.",
  product_order: [],
};

export const Route = createFileRoute("/merch/")({
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

  const { data: settings = DEFAULT_SETTINGS } = useQuery({
    queryKey: ["merch_settings"],
    queryFn: async (): Promise<MerchSettings> => {
      const { data } = await supabase
        .from("site_content")
        .select("value")
        .eq("key", "merch_settings")
        .maybeSingle();
      return { ...DEFAULT_SETTINGS, ...((data?.value as Partial<MerchSettings>) ?? {}) };
    },
  });

  const ordered = (() => {
    if (!settings.product_order.length) return products;
    const rank = new Map(settings.product_order.map((id, i) => [id, i]));
    return [...products].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
  })();

  return (
    <Layout>
      <PageHeader
        eyebrow={settings.eyebrow}
        title={settings.title}
        description={settings.description}
      />
      <section className="mx-auto max-w-7xl px-4 py-10">
        {isLoading && <p className="text-sm text-muted-foreground">Loading merch…</p>}
        {error && <p className="text-sm text-red-600">Couldn't load merch right now. Try again shortly.</p>}
        {!isLoading && !error && ordered.length === 0 && (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="font-semibold text-primary">No merch listed yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Check back soon — designs are on the way.</p>
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {ordered.map((p) => (
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
