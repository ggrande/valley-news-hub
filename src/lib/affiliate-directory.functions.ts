import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

export type PublicStation = {
  kind: "managed" | "self_host";
  display_name: string;
  tagline: string | null;
  city: string | null;
  region: string | null;
  logo_url: string | null;
  website_url: string;
  since: string | null;
};

export type ManagedSiteDirectoryProfile = {
  id: string;
  display_name: string;
  subdomain: string;
  custom_domain: string | null;
  directory_opt_in: boolean;
  directory_tagline: string | null;
  directory_city: string | null;
  directory_region: string | null;
  directory_logo_url: string | null;
  directory_website_url: string | null;
  onboarding_completed_at: string | null;
  auto_apply_security: boolean;
};

export type SelfHostDirectoryEntry = {
  id: string;
  display_name: string;
  tagline: string | null;
  city: string | null;
  region: string | null;
  logo_url: string | null;
  website_url: string;
  approved: boolean;
  license_id: string | null;
};

/** Public, anon-callable listing for the affiliate stations directory. */
export const listPublicAffiliateStations = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicStation[]> => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await (supabase as any).rpc("list_public_affiliate_stations");
    if (error) throw new Error(error.message);
    return (data ?? []) as PublicStation[];
  },
);

/** Fetch a managed site I own, with the directory + onboarding fields. */
export const getMyManagedSiteProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data, context }): Promise<ManagedSiteDirectoryProfile> => {
    const { data: row, error } = await (context.supabase as any)
      .from("managed_sites")
      .select(
        "id, display_name, subdomain, custom_domain, directory_opt_in, directory_tagline, directory_city, directory_region, directory_logo_url, directory_website_url, onboarding_completed_at, auto_apply_security",
      )
      .eq("id", data.siteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Site not found");
    return row as ManagedSiteDirectoryProfile;
  });

/** Update directory + branding fields on a managed site I own. */
export const updateMyManagedSiteProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      siteId: string;
      display_name?: string;
      custom_domain?: string | null;
      directory_opt_in?: boolean;
      directory_tagline?: string | null;
      directory_city?: string | null;
      directory_region?: string | null;
      directory_logo_url?: string | null;
      directory_website_url?: string | null;
      markOnboardingComplete?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    const trim = (v: string | null | undefined, max = 240) =>
      v == null ? v : v.toString().slice(0, max).trim() || null;
    if (data.display_name !== undefined) patch.display_name = data.display_name.slice(0, 120);
    if (data.custom_domain !== undefined) patch.custom_domain = data.custom_domain || null;
    if (data.directory_opt_in !== undefined) patch.directory_opt_in = !!data.directory_opt_in;
    if (data.directory_tagline !== undefined) patch.directory_tagline = trim(data.directory_tagline, 200);
    if (data.directory_city !== undefined) patch.directory_city = trim(data.directory_city, 120);
    if (data.directory_region !== undefined) patch.directory_region = trim(data.directory_region, 120);
    if (data.directory_logo_url !== undefined) patch.directory_logo_url = trim(data.directory_logo_url, 500);
    if (data.directory_website_url !== undefined) patch.directory_website_url = trim(data.directory_website_url, 500);
    if (data.markOnboardingComplete) patch.onboarding_completed_at = new Date().toISOString();

    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await (context.supabase as any)
      .from("managed_sites")
      .update(patch)
      .eq("id", data.siteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Self-host directory entry CRUD (one per user). */
export const getMySelfHostDirectoryEntry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SelfHostDirectoryEntry | null> => {
    const { data, error } = await (context.supabase as any)
      .from("affiliate_directory_entries")
      .select("id, display_name, tagline, city, region, logo_url, website_url, approved, license_id")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as SelfHostDirectoryEntry | null;
  });

export const upsertMySelfHostDirectoryEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      display_name: string;
      website_url: string;
      tagline?: string | null;
      city?: string | null;
      region?: string | null;
      logo_url?: string | null;
      license_id?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    if (!data.display_name?.trim() || !data.website_url?.trim()) {
      throw new Error("Station name and website URL are required");
    }
    if (!/^https?:\/\//i.test(data.website_url)) {
      throw new Error("Website URL must start with http:// or https://");
    }
    const row = {
      owner_user_id: context.userId,
      display_name: data.display_name.slice(0, 120),
      website_url: data.website_url.slice(0, 500),
      tagline: data.tagline?.slice(0, 200) || null,
      city: data.city?.slice(0, 120) || null,
      region: data.region?.slice(0, 120) || null,
      logo_url: data.logo_url?.slice(0, 500) || null,
      license_id: data.license_id || null,
      // New + edited entries always go back to pending review
      approved: false,
    };
    const { error } = await (context.supabase as any)
      .from("affiliate_directory_entries")
      .upsert(row, { onConflict: "owner_user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
