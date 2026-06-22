import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const generateArticleFromImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { importId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!roleRow) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateOne } = await import("@/lib/cron-generate.server");
    return await generateOne(supabaseAdmin, data.importId);
  });

export const drainBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { batchId: string; limit?: number }) => input)
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!roleRow) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateOne } = await import("@/lib/cron-generate.server");

    const limit = data.limit ?? 10;

    // Auto-discard removed/deleted source posts so we don't waste AI calls.
    const { data: pending } = await supabaseAdmin
      .from("reddit_imports")
      .select("id, original_body, original_title")
      .eq("batch_id", data.batchId)
      .eq("import_status", "new");
    const removedIds = (pending ?? [])
      .filter((r: any) => {
        const b = (r.original_body ?? "").trim().toLowerCase();
        const t = (r.original_title ?? "").trim().toLowerCase();
        return b === "[removed]" || b === "[deleted]" || t === "[removed]" || t === "[deleted]";
      })
      .map((r: any) => r.id);
    if (removedIds.length) {
      await supabaseAdmin
        .from("reddit_imports")
        .update({ import_status: "discarded", processing_error: "Source removed/deleted" })
        .in("id", removedIds);
    }

    const { data: rows } = await supabaseAdmin
      .from("reddit_imports")
      .select("id")
      .eq("batch_id", data.batchId)
      .eq("import_status", "new")
      .order("original_created_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const r of rows ?? []) {
      try {
        await generateOne(supabaseAdmin, r.id);
        results.push({ id: r.id, ok: true });
      } catch (err: any) {
        results.push({ id: r.id, ok: false, error: String(err?.message ?? err) });
      }
    }

    const { count: remaining } = await supabaseAdmin
      .from("reddit_imports")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", data.batchId)
      .eq("import_status", "new");

    return { processed: results.length, results, remaining: remaining ?? 0, discarded: removedIds.length };
  });

export const publishPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!roleRow) throw new Response("Forbidden", { status: 403 });
    const { error } = await context.supabase
      .from("posts")
      .update({ status: "published" })
      .eq("id", data.postId);
    if (error) throw error;
    return { ok: true };
  });
