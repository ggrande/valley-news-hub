import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Layout } from "@/components/site/Layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getMerchProduct } from "@/lib/merch.functions";
import { MerchEmbeddedCheckout } from "@/components/MerchEmbeddedCheckout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/merch/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `WKNA 49 Merch — Item ${params.id}` },
      { name: "description", content: "Official WKNA 49 News merch — print-on-demand, shipped to your door." },
    ],
  }),
  component: MerchDetail,
  errorComponent: ({ error }) => <Layout><div className="p-12 text-center text-red-600">{error.message}</div></Layout>,
  notFoundComponent: () => <Layout><div className="p-12 text-center">Product not found.</div></Layout>,
});

function MerchDetail() {
  const { id } = Route.useParams();
  const numId = Number(id);
  const { data, isLoading, error } = useQuery({
    queryKey: ["merch-product", numId],
    queryFn: () => getMerchProduct({ data: { id: numId } }),
    enabled: Number.isFinite(numId),
  });

  const [variantId, setVariantId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? undefined);
      setUserId(data.user?.id);
    });
  }, []);

  useEffect(() => {
    if (data && data.variants[0] && variantId == null) setVariantId(data.variants[0].id);
  }, [data, variantId]);

  if (isLoading) return <Layout><div className="p-12 text-center text-muted-foreground">Loading…</div></Layout>;
  if (error || !data) return <Layout><div className="p-12 text-center text-red-600">{(error as any)?.message || "Couldn't load product."}</div></Layout>;

  const selected = data.variants.find((v) => v.id === variantId) ?? data.variants[0];
  const priceCents = selected ? Math.round(Number(selected.retail_price) * 100) : 0;

  return (
    <Layout>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border bg-muted">
          {selected?.image && <img src={selected.image} alt={data.name} className="h-full w-full object-cover" />}
        </div>
        <div>
          <h1 className="font-display text-3xl font-black text-primary">{data.name}</h1>
          {selected && (
            <p className="mt-2 text-2xl font-bold text-primary">${Number(selected.retail_price).toFixed(2)}</p>
          )}
          {data.variants.length > 1 && (
            <div className="mt-6">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variant</label>
              <select
                value={variantId ?? ""}
                onChange={(e) => setVariantId(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {data.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — ${Number(v.retail_price).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quantity</label>
            <input
              type="number"
              min={1}
              max={10}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              className="mt-1 block w-24 rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={!selected}
            onClick={() => setOpen(true)}
            className="mt-8 h-12 w-full rounded-md bg-[color:var(--breaking)] text-base font-semibold text-white disabled:opacity-50"
          >
            Buy now — ${(priceCents / 100 * qty).toFixed(2)} + shipping
          </button>
          <p className="mt-3 text-xs text-muted-foreground">Print-on-demand. Ships in 5–10 business days via Printful. US &amp; Canada only for now.</p>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Checkout</DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto p-2">
            {selected && open && (
              <MerchEmbeddedCheckout
                syncVariantId={selected.id}
                productName={`${data.name} — ${selected.name}`}
                unitPriceCents={priceCents}
                quantity={qty}
                image={selected.image}
                customerEmail={email}
                userId={userId}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
