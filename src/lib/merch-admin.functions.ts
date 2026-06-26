import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RetryResult = { id: string; ok?: boolean; printful_id?: number; error?: string; skipped?: string };

export const retryMerchOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id?: string }) => data ?? {})
  .handler(async ({ data, context }): Promise<{ retried: number; results: RetryResult[] } | { error: string }> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { error: "Forbidden" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("merch_orders").select("*").eq("status", "submit_failed");
    if (data.id) q = q.eq("id", data.id);
    const { data: rows, error } = await q.limit(20);
    if (error) return { error: error.message };

    const { createOrder } = await import("@/lib/printful.server");
    const results: RetryResult[] = [];

    for (const row of (rows as any[]) ?? []) {
      const item = row.items?.[0] ?? {};
      const syncVariantId = Number(item.sync_variant_id);
      const quantity = Number(item.quantity) || 1;
      const sa = row.shipping_address ?? {};
      const addr = sa.address ?? {};
      const recipient = {
        name: sa.name || row.email,
        address1: addr.line1,
        address2: addr.line2 || undefined,
        city: addr.city,
        state_code: addr.state,
        country_code: addr.country,
        zip: addr.postal_code,
        email: row.email,
      };
      if (!recipient.address1 || !syncVariantId) {
        results.push({ id: row.id, skipped: "missing address or variant" });
        continue;
      }
      try {
        const externalId = String(row.id).replace(/-/g, "");
        const result = await createOrder({
          external_id: externalId,
          recipient: recipient as any,
          items: [{ sync_variant_id: syncVariantId, quantity }],
          confirm: row.environment === "live",
        });
        await supabaseAdmin.from("merch_orders").update({
          status: "submitted",
          printful_order_id: String(result.id),
          error: null,
        }).eq("id", row.id);
        results.push({ id: row.id, ok: true, printful_id: result.id });
      } catch (e: any) {
        const msg = String(e?.message || e).slice(0, 1000);
        await supabaseAdmin.from("merch_orders").update({ error: msg }).eq("id", row.id);
        results.push({ id: row.id, error: msg });
      }
    }

    return { retried: results.length, results };
  });
