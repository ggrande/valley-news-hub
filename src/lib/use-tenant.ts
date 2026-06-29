import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTenantByHost, type TenantBranding } from "@/lib/tenant-resolver.functions";

/**
 * Resolves the active tenant (managed Affiliate Station) from the current
 * hostname. Returns `null` for the master site (wkna49.com / www / previews).
 *
 * Cached for 5 minutes per host so brand chrome doesn't refetch on every nav.
 */
export function useTenant(): { tenant: TenantBranding; isLoading: boolean } {
  const fn = useServerFn(getTenantByHost);
  const host = typeof window !== "undefined" ? window.location.host : "";
  const q = useQuery({
    queryKey: ["tenant-by-host", host],
    queryFn: () => fn({ data: { host } }),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return { tenant: (q.data ?? null) as TenantBranding, isLoading: q.isLoading };
}
