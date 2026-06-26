import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Retry merch_orders rows in `submit_failed` status by resubmitting to Printful.
// Auth: either x-cron-secret header OR a signed-in admin (Bearer token).
// Optional ?id=<order uuid> to retry a single row.
export const Route = createFileRoute("/api/public/hooks/retry-merch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret");
        const auth = request.headers.get("authorization") || request.headers.get("Authorization");
        let authorized = !!secret && secret === process.env.CRON_SECRET;

        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );

        if (!authorized && auth?.startsWith("Bearer ")) {
          const token = auth.slice(7);
          const { data: userRes } = await admin.auth.getUser(token);
          const uid = userRes?.user?.id;
          if (uid) {
            const { data: isAdmin } = await admin.rpc("has_role", {
              _user_id: uid,
              _role: "admin",
            });
            if (isAdmin) authorized = true;
          }
        }
        if (!authorized) return new Response("Unauthorized", { status: 401 });

        const url = new URL(request.url);
        const onlyId = url.searchParams.get("id");

        let q = admin.from("merch_orders").select("*").eq("status", "submit_failed");
        if (onlyId) q = q.eq("id", onlyId);
        const { data: rows, error } = await q.limit(20);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const { createOrder } = await import("@/lib/printful.server");
        const results: any[] = [];

        for (const row of (rows as any[]) ?? []) {
          const item = (row.items?.[0]) ?? {};
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
            await admin.from("merch_orders").update({
              status: "submitted",
              printful_order_id: String(result.id),
              error: null,
            }).eq("id", row.id);
            results.push({ id: row.id, ok: true, printful_id: result.id });
          } catch (e: any) {
            const msg = String(e?.message || e).slice(0, 1000);
            await admin.from("merch_orders").update({ error: msg }).eq("id", row.id);
            results.push({ id: row.id, error: msg });
          }
        }

        return Response.json({ retried: results.length, results });
      },
    },
  },
});
