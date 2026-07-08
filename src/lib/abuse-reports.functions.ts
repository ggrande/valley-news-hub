// Public abuse-report submission + admin queue management.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_KIND = new Set(["post", "comment", "other"]);
const ALLOWED_STATUS = new Set(["open", "reviewing", "dismissed", "actioned"]);

export const submitAbuseReport = createServerFn({ method: "POST" })
  .inputValidator((d: {
    target_kind: "post" | "comment" | "other";
    target_id: string;
    target_url?: string | null;
    managed_site_id?: string | null;
    reporter_email?: string | null;
    reason: string;
    details?: string | null;
  }) => d)
  .handler(async ({ data }) => {
    if (!ALLOWED_KIND.has(data.target_kind)) throw new Error("Invalid target_kind");
    const reason = (data.reason ?? "").trim();
    if (reason.length < 3 || reason.length > 200) throw new Error("Reason must be 3-200 chars");
    const details = (data.details ?? "").slice(0, 4000);
    const email = (data.reporter_email ?? "").trim().toLowerCase() || null;
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid email");

    const req = getRequest();
    const { callerIp, enforceRateLimit, hashKey } = await import("@/lib/rate-limit.server");
    const ip = callerIp(req ?? undefined);
    await enforceRateLimit({ scope: "abuse", key: ip, siteId: data.managed_site_id ?? null });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("abuse_reports").insert({
      managed_site_id: data.managed_site_id ?? null,
      target_kind: data.target_kind,
      target_id: String(data.target_id).slice(0, 200),
      target_url: data.target_url ? String(data.target_url).slice(0, 500) : null,
      reporter_email: email,
      reporter_ip_hash: hashKey(ip),
      reason,
      details: details || null,
      status: "open",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAbuseReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("abuse_reports")
      .select("id, managed_site_id, target_kind, target_id, target_url, reporter_email, reason, details, status, admin_notes, actioned_at, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 200));
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { reports: rows ?? [] };
  });

export const updateAbuseReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: string; admin_notes?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });
    const patch: Record<string, unknown> = {};
    if (data.status) {
      if (!ALLOWED_STATUS.has(data.status)) throw new Error("Invalid status");
      patch.status = data.status;
      if (data.status === "actioned" || data.status === "dismissed") {
        patch.actioned_by = context.userId;
        patch.actioned_at = new Date().toISOString();
      }
    }
    if (data.admin_notes !== undefined) patch.admin_notes = data.admin_notes;
    if (!Object.keys(patch).length) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("abuse_reports").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
