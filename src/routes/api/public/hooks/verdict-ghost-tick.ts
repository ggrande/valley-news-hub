// pg_cron-callable: drips ghost votes into all live battles every minute.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/verdict-ghost-tick")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const { data: setting } = await admin
          .from("site_settings").select("value").eq("key", "verdict_arena_enabled").maybeSingle();
        if (setting?.value !== true) return Response.json({ ok: true, disabled: true });

        const { data: battles } = await admin
          .from("verdict_battles")
          .select("id")
          .eq("status", "live");
        let total = 0;
        const { tickGhosts } = await import("@/lib/verdict-ghost.server");
        for (const b of (battles ?? []) as any[]) {
          total += await tickGhosts(admin, b.id);
        }
        return Response.json({ ok: true, dripped: total, battles: battles?.length ?? 0 });
      },
    },
  },
});
