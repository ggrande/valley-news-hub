import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LicenseRow = {
  id: string;
  license_key: string;
  email: string;
  channel: string;
  current_version: string | null;
  last_check_at: string | null;
  downloads_used: number;
  downloads_max: number;
  revoked: boolean;
  created_at: string;
  purchase_id: string | null;
};

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

/** Licenses owned by the signed-in user (matched on purchase user_id or email). */
export const listMyLicenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LicenseRow[]> => {
    const { data: u } = await context.supabase.auth.getUser();
    const email = u?.user?.email ?? "";
    // First grab the user's purchases (RLS already scopes to them)
    const { data: purchases } = await (context.supabase as any)
      .from("network_purchases")
      .select("id,email")
      .eq("tier", "self_host_license");
    const purchaseIds = (purchases ?? []).map((p: any) => p.id);
    const emails = Array.from(
      new Set([email, ...((purchases ?? []).map((p: any) => p.email).filter(Boolean) as string[])]),
    ).filter(Boolean);

    if (purchaseIds.length === 0 && emails.length === 0) return [];

    const orParts: string[] = [];
    if (purchaseIds.length) orParts.push(`purchase_id.in.(${purchaseIds.join(",")})`);
    if (emails.length) orParts.push(`email.in.(${emails.map((e) => `"${e}"`).join(",")})`);

    // Admin can see all; regular users only their own via the OR filter
    let q = (context.supabase as any).from("licenses").select("*").order("created_at", { ascending: false });
    if (!(await isAdmin(context.supabase, context.userId))) {
      q = q.or(orParts.join(","));
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as LicenseRow[];
  });

/** Mint a short-lived signed download URL for the latest release on a license. */
export const getMyLicenseDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { licenseId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Confirm the caller owns the license (or is admin)
    const { data: lic, error: lerr } = await (context.supabase as any)
      .from("licenses")
      .select("id,channel,revoked,downloads_used,downloads_max")
      .eq("id", data.licenseId)
      .maybeSingle();
    if (lerr || !lic) throw new Error("License not found");
    if (lic.revoked) throw new Error("License revoked");
    if (lic.downloads_used >= lic.downloads_max) throw new Error("Download limit reached");

    const { data: latest } = await (supabaseAdmin as any)
      .from("platform_releases")
      .select("id,version,zip_path")
      .eq("channel", lic.channel || "stable")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest?.zip_path) throw new Error("No release available");

    const { data: signed, error: serr } = await supabaseAdmin.storage
      .from("network-releases")
      .createSignedUrl(latest.zip_path, 60 * 15);
    if (serr || !signed?.signedUrl) throw new Error(serr?.message || "Failed to sign URL");

    await (supabaseAdmin as any)
      .from("licenses")
      .update({
        downloads_used: (lic.downloads_used ?? 0) + 1,
        last_check_at: new Date().toISOString(),
      })
      .eq("id", lic.id);

    return { url: signed.signedUrl, version: latest.version as string };
  });

/** Admin: list all licenses with purchase info. */
export const adminListLicenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LicenseRow[]> => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { data, error } = await (context.supabase as any)
      .from("licenses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as LicenseRow[];
  });

/** Admin: toggle revoke state. */
export const setLicenseRevoked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; revoked: boolean }) => d)
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Forbidden");
    const { error } = await (context.supabase as any)
      .from("licenses")
      .update({ revoked: data.revoked })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
