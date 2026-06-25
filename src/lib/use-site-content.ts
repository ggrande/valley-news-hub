import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SiteContentMap = Record<string, any>;

async function fetchSiteContent(): Promise<SiteContentMap> {
  const { data } = await supabase.from("site_content").select("key,value");
  const map: SiteContentMap = {};
  for (const r of data ?? []) map[(r as any).key] = (r as any).value;
  return map;
}

export function useSiteContent<T = any>(key: string, fallback: T): T {
  const q = useQuery({
    queryKey: ["site_content"],
    queryFn: fetchSiteContent,
    staleTime: 60_000,
  });
  const val = q.data?.[key];
  if (val == null) return fallback;
  if (typeof fallback === "object" && fallback !== null && !Array.isArray(fallback)) {
    return { ...(fallback as any), ...(val as any) } as T;
  }
  return val as T;
}

export function useAllSiteContent() {
  return useQuery({
    queryKey: ["site_content"],
    queryFn: fetchSiteContent,
    staleTime: 60_000,
  });
}
