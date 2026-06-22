import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Public endpoint called every 6h by pg_cron. Drains up to N pending imports through AI generation.
// Authenticated via Supabase anon `apikey` header (which pg_cron sends).
export const Route = createFileRoute("/api/public/hooks/process-pending")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Forbidden", { status: 403 });
        }

        const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

        // Auto-discard removed/deleted posts globally before draining
        const { data: pending } = await admin
          .from("reddit_imports")
          .select("id, original_body, original_title")
          .eq("import_status", "new");
        const removedIds = (pending ?? [])
          .filter((r: any) => {
            const b = (r.original_body ?? "").trim().toLowerCase();
            const t = (r.original_title ?? "").trim().toLowerCase();
            return b === "[removed]" || b === "[deleted]" || t === "[removed]" || t === "[deleted]";
          })
          .map((r: any) => r.id);
        if (removedIds.length) {
          await admin
            .from("reddit_imports")
            .update({ import_status: "discarded", processing_error: "Source removed/deleted" })
            .in("id", removedIds);
        }

        const { data: rows } = await admin
          .from("reddit_imports")
          .select("id")
          .eq("import_status", "new")
          .order("original_created_at", { ascending: false, nullsFirst: false })
          .limit(10);

        if (!rows?.length) return new Response(JSON.stringify({ processed: 0 }), { headers: { "Content-Type": "application/json" } });

        // Call self-hosted server fn endpoint via inline import is tricky here; instead, replicate minimal generation logic by invoking the user-side server fn via fetch is overkill.
        // Simplest: call the same Lovable AI gateway directly here for each row.
        const { generateOne } = await import("@/lib/cron-generate.server");
        const results: Array<{ id: string; ok: boolean; error?: string }> = [];
        for (const r of rows) {
          try {
            await generateOne(admin, r.id);
            results.push({ id: r.id, ok: true });
          } catch (err: any) {
            results.push({ id: r.id, ok: false, error: String(err?.message ?? err) });
          }
        }
        return new Response(JSON.stringify({ processed: results.length, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
