// Admin observability for the affiliate-station network.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
}

export const getNetworkHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { hours?: number }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const hours = Math.min(Math.max(data.hours ?? 24, 1), 24 * 30);
    const sinceIso = new Date(Date.now() - hours * 3600_000).toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [errorsRes, rateRes, aiUsageRes, abuseRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("tenant_error_events")
        .select("id, managed_site_id, kind, message, created_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(200),
      (supabaseAdmin as any)
        .from("rate_limit_events")
        .select("scope, occurred_at, managed_site_id")
        .gte("occurred_at", sinceIso)
        .limit(2000),
      (supabaseAdmin as any)
        .from("tenant_ai_usage")
        .select("op_type, succeeded, managed_site_id, created_at")
        .gte("created_at", sinceIso)
        .limit(5000),
      (supabaseAdmin as any)
        .from("abuse_reports")
        .select("id, status")
        .eq("status", "open"),
    ]);

    const errorsByKind: Record<string, number> = {};
    for (const e of errorsRes.data ?? []) errorsByKind[e.kind] = (errorsByKind[e.kind] ?? 0) + 1;

    const rateByScope: Record<string, number> = {};
    for (const r of rateRes.data ?? []) rateByScope[r.scope] = (rateByScope[r.scope] ?? 0) + 1;

    const aiByOp: Record<string, { ok: number; err: number }> = {};
    for (const u of aiUsageRes.data ?? []) {
      const b = (aiByOp[u.op_type] ??= { ok: 0, err: 0 });
      if (u.succeeded) b.ok++; else b.err++;
    }

    return {
      hours,
      recentErrors: errorsRes.data ?? [],
      errorsByKind,
      rateByScope,
      aiByOp,
      openAbuseReports: (abuseRes.data ?? []).length,
    };
  });
