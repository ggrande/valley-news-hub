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

    const { data: rows } = await supabaseAdmin
      .from("reddit_imports")
      .select("id")
      .eq("batch_id", data.batchId)
      .eq("import_status", "new")
      .limit(data.limit ?? 5);

    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const r of rows ?? []) {
      try {
        await generateOne(supabaseAdmin, r.id);
        results.push({ id: r.id, ok: true });
      } catch (err: any) {
        results.push({ id: r.id, ok: false, error: String(err?.message ?? err) });
      }
    }
    return { processed: results.length, results };
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
