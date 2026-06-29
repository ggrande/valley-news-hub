import { useRouter } from "@tanstack/react-router";

export type TenantSite = {
  siteId: string;
  slug: string;
  displayName: string;
  customDomain: string | null;
  status: string;
  networkSyncEnabled: boolean;
  logoUrl: string | null;
  tagline: string | null;
  city: string | null;
  region: string | null;
  websiteUrl: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
} | null;

// Read the tenant resolved by the parent /network_/$siteSlug route.
export function useTenantSite(): TenantSite {
  const router = useRouter();
  try {
    const parent = (router as any).routesById?.["/network_/$siteSlug"];
    const data = parent?.useLoaderData?.();
    return (data?.tenant ?? null) as TenantSite;
  } catch {
    return null;
  }
}
