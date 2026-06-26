import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { retryMerchOrders } from "@/lib/merch-admin.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/merch")({
  head: () => ({ meta: [{ title: "Merch Orders — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminMerchPage,
});

function AdminMerchPage() {
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-merch-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merch_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const retryFn = useServerFn(retryMerchOrders);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleRetry = async (id?: string) => {
    setBusyId(id ?? "all");
    try {
      const res: any = await retryFn({ data: { id } });
      if (res.error) toast.error(res.error);
      else {
        const ok = res.results.filter((r: any) => r.ok).length;
        const fail = res.results.filter((r: any) => r.error).length;
        toast.success(`Retried ${res.retried} — ${ok} ok, ${fail} failed`);
      }
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Retry failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-black text-primary">Merch Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All Print-on-demand orders. Failed submissions are flagged red — click Retry to resubmit to Printful.
          </p>
        </div>
        <Button onClick={() => handleRetry()} disabled={busyId !== null || !orders.some((o: any) => o.status === "submit_failed")} variant="outline">
          {busyId === "all" ? "Retrying…" : "Retry all failed"}
        </Button>
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      <div className="mt-6 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Items</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Printful</th>
              <th className="px-3 py-2">Env</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o: any) => (
              <tr key={o.id} className="border-t">
                <td className="px-3 py-2 text-xs">{new Date(o.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{o.email}</td>
                <td className="px-3 py-2 max-w-[20rem] truncate">
                  {(o.items as any[])?.map?.((i: any) => `${i.name} ×${i.quantity}`).join(", ")}
                </td>
                <td className="px-3 py-2">${((o.amount_cents ?? 0) / 100).toFixed(2)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    o.status === "submit_failed" ? "bg-red-100 text-red-800"
                    : o.status === "submitted" || o.status === "fulfilled" ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
                  }`}>{o.status}</span>
                  {o.error && <p className="mt-1 max-w-xs truncate text-[10px] text-red-700">{o.error}</p>}
                </td>
                <td className="px-3 py-2 text-xs">{o.printful_order_id ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{o.environment}</td>
                <td className="px-3 py-2 text-right">
                  {o.status === "submit_failed" && (
                    <Button
                      size="sm"
                      variant="default"
                      disabled={busyId !== null}
                      onClick={() => handleRetry(o.id)}
                    >
                      {busyId === o.id ? "…" : "Retry"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
