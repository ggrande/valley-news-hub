// Tiny hook — reads verdict_arena_enabled from site_settings.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSettingEnabled(): boolean {
  const q = useQuery({
    queryKey: ["verdict_arena_enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings").select("value").eq("key", "verdict_arena_enabled").maybeSingle();
      return data?.value === true;
    },
    staleTime: 60_000,
  });
  return !!q.data;
}
