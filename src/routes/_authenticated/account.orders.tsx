import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account/orders")({
  head: () => ({ meta: [{ title: "My Orders — WKNA 49" }, { name: "robots", content: "noindex" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-merch-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merch_orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <h1 className="font-display text-3xl font-black text-primary">My Merch Orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">Print-on-demand orders fulfilled through Printful.</p>
      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && orders.length === 0 && (
        <div className="mt-8 rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          You haven't placed any merch orders yet.
        </div>
      )}
      <ul className="mt-6 space-y-3">
        {orders.map((o: any) => (
          <li key={o.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-primary">
                  {(o.items as any[])?.map?.((i) => i.name).join(", ") || "Merch order"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString()} · ${((o.amount_cents ?? 0) / 100).toFixed(2)}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                o.status === "submit_failed" ? "bg-red-100 text-red-800"
                : o.status === "submitted" || o.status === "fulfilled" ? "bg-green-100 text-green-800"
                : "bg-amber-100 text-amber-800"
              }`}>{o.status}</span>
            </div>
            {o.tracking_url && (
              <a href={o.tracking_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-[color:var(--broadcast)] underline">
                Track shipment →
              </a>
            )}
            {o.error && <p className="mt-2 text-xs text-red-700">Error: {o.error}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
