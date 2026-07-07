import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ManagedSiteRow = {
  id: string;
  owner_user_id: string | null;
  owner_email: string;
  subdomain: string;
  custom_domain: string | null;
  display_name: string;
  status: string;
  subscription_status: string;
  current_release_id: string | null;
  pending_release_id: string | null;
  auto_apply_security: boolean;
  last_deployed_at: string | null;
  notes: string | null;
  created_at: string;
  onboarding_completed_at: string | null;
  directory_opt_in: boolean;
  custom_domain_status: string | null;
  current_release?: { version: string; channel: string } | null;
  pending_release?: { version: string; channel: string; notes: string | null; is_security: boolean; is_breaking: boolean } | null;
};

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

const SITE_SELECT = `
  id, owner_user_id, owner_email, subdomain, custom_domain, display_name,
  status, subscription_status, current_release_id, pending_release_id,
  auto_apply_security, last_deployed_at, notes, created_at,
  onboarding_completed_at, directory_opt_in, custom_domain_status,
  current_release:platform_releases!managed_sites_current_release_id_fkey(version,channel),
  pending_release:platform_releases!managed_sites_pending_release_id_fkey(version,channel,notes,is_security,is_breaking)
`;


export const listMyManagedSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedSiteRow[]> => {
    const { data, error } = await (context.supabase as any)
      .from("managed_sites")
      .select(SITE_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ManagedSiteRow[];
  });

export const adminListManagedSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedSiteRow[]> => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select(SITE_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ManagedSiteRow[];
  });

export const updateManagedSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    siteId: string;
    display_name?: string;
    custom_domain?: string | null;
    auto_apply_security?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.display_name !== undefined) patch.display_name = data.display_name.slice(0, 120);
    if (data.custom_domain !== undefined) patch.custom_domain = data.custom_domain || null;
    if (data.auto_apply_security !== undefined) patch.auto_apply_security = data.auto_apply_security;
    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await (context.supabase as any)
      .from("managed_sites")
      .update(patch)
      .eq("id", data.siteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Accept the pending release: marks it as current and clears pending. Records an event. */
export const acceptPendingRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: site, error: serr } = await (context.supabase as any)
      .from("managed_sites")
      .select("id, pending_release_id")
      .eq("id", data.siteId)
      .maybeSingle();
    if (serr || !site) throw new Error("Site not found");
    if (!site.pending_release_id) throw new Error("No pending release");

    const { error: uerr } = await (context.supabase as any)
      .from("managed_sites")
      .update({
        current_release_id: site.pending_release_id,
        pending_release_id: null,
        last_deployed_at: new Date().toISOString(),
        status: "active",
      })
      .eq("id", site.id);
    if (uerr) throw new Error(uerr.message);

    await (context.supabase as any).from("managed_site_release_events").insert({
      site_id: site.id,
      release_id: site.pending_release_id,
      event_type: "accepted",
      actor_user_id: context.userId,
    });
    return { ok: true };
  });

export const rejectPendingRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { siteId: string; notes?: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: site } = await (context.supabase as any)
      .from("managed_sites")
      .select("id, pending_release_id")
      .eq("id", data.siteId)
      .maybeSingle();
    if (!site?.pending_release_id) throw new Error("No pending release");

    await (context.supabase as any).from("managed_site_release_events").insert({
      site_id: site.id,
      release_id: site.pending_release_id,
      event_type: "rejected",
      actor_user_id: context.userId,
      notes: data.notes ?? null,
    });

    const { error } = await (context.supabase as any)
      .from("managed_sites")
      .update({ pending_release_id: null })
      .eq("id", site.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: stage a release for one or all managed sites. */
export const adminStageReleaseForSites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { releaseId: string; siteId?: string }) => d)
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: release } = await (supabaseAdmin as any)
      .from("platform_releases")
      .select("id, is_security, channel")
      .eq("id", data.releaseId)
      .maybeSingle();
    if (!release) throw new Error("Release not found");

    let q = (supabaseAdmin as any)
      .from("managed_sites")
      .update({ pending_release_id: release.id })
      .eq("subscription_status", "active");
    if (data.siteId) q = q.eq("id", data.siteId);
    const { error, count } = await q.select("id", { count: "exact" });
    if (error) throw new Error(error.message);

    // Auto-accept for sites with auto_apply_security on, if security release
    if (release.is_security) {
      const { data: autoSites } = await (supabaseAdmin as any)
        .from("managed_sites")
        .select("id")
        .eq("auto_apply_security", true)
        .eq("pending_release_id", release.id);
      for (const s of autoSites ?? []) {
        await (supabaseAdmin as any)
          .from("managed_sites")
          .update({
            current_release_id: release.id,
            pending_release_id: null,
            last_deployed_at: new Date().toISOString(),
            status: "active",
          })
          .eq("id", s.id);
        await (supabaseAdmin as any).from("managed_site_release_events").insert({
          site_id: s.id,
          release_id: release.id,
          event_type: "auto_accepted_security",
        });
      }
    }

    return { ok: true, staged: count ?? 0 };
  });

/** Admin: force a managed site to a specific status. Records an event. */
export const adminSetSiteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { siteId: string; status: "active" | "suspended" | "provisioning" | "failed"; notes?: string }) => {
    if (!["active", "suspended", "provisioning", "failed"].includes(d.status)) {
      throw new Error("Invalid status");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { status: data.status };
    if (data.notes !== undefined) patch.notes = data.notes;
    const { error } = await (supabaseAdmin as any)
      .from("managed_sites")
      .update(patch)
      .eq("id", data.siteId);
    if (error) throw new Error(error.message);
    return { ok: true, status: data.status };
  });

