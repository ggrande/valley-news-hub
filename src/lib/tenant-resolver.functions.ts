// Resolves the active tenant (managed_site) from the request host.
// Used by the shared frontend to render per-tenant branding on subdomains
// like `{site}.wkna49.com` or custom domains.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export type TenantBranding = {
  siteId: string;
  displayName: string;
  subdomain: string | null;
  customDomain: string | null;
  logoUrl: string | null;
  tagline: string | null;
  city: string | null;
  region: string | null;
  websiteUrl: string | null;
} | null;

function normalizeHost(h: string | null | undefined): string | null {
  if (!h) return null;
  return h.split(":")[0].toLowerCase();
}

export const getTenantByHost = createServerFn({ method: "GET" })
  .inputValidator((d: { host?: string }) => d ?? {})
  .handler(async ({ data }): Promise<TenantBranding> => {
    const req = getRequest();
    const host = normalizeHost(data?.host || req?.headers.get("host"));
    if (!host) return null;
    // Master domains are never tenants.
    if (host === "wkna49.com" || host === "www.wkna49.com") return null;
    if (host.endsWith(".lovable.app")) return null;
    if (host === "localhost" || host.startsWith("127.")) return null;

    const sub = host.endsWith(".wkna49.com")
      ? host.replace(/\.wkna49\.com$/, "")
      : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const orClauses: string[] = [];
    if (sub) orClauses.push(`subdomain.eq.${sub}`);
    orClauses.push(`custom_domain.eq.${host}`);

    const { data: row } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select(
        "id, display_name, subdomain, custom_domain, directory_logo_url, directory_tagline, directory_city, directory_region, directory_website_url, status"
      )
      .or(orClauses.join(","))
      .maybeSingle();

    if (!row) return null;
    return {
      siteId: row.id,
      displayName: row.display_name,
      subdomain: row.subdomain,
      customDomain: row.custom_domain,
      logoUrl: row.directory_logo_url ?? null,
      tagline: row.directory_tagline ?? null,
      city: row.directory_city ?? null,
      region: row.directory_region ?? null,
      websiteUrl: row.directory_website_url ?? null,
    };
  });
