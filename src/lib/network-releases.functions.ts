import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Release = {
  id: string;
  version: string;
  channel: string;
  title: string;
  changelog_md: string;
  breaking: boolean;
  security: boolean;
  zip_path: string | null;
  zip_sha256: string | null;
  zip_bytes: number | null;
  published_at: string | null;
  created_at: string;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
}

export const listAllReleases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Release[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("platform_releases")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as Release[];
  });

export const upsertRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      version: string;
      channel: "stable" | "beta";
      title: string;
      changelog_md: string;
      breaking: boolean;
      security: boolean;
      zip_path?: string | null;
      zip_sha256?: string | null;
      zip_bytes?: number | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const row: any = {
      version: data.version.trim(),
      channel: data.channel,
      title: data.title,
      changelog_md: data.changelog_md,
      breaking: data.breaking,
      security: data.security,
      zip_path: data.zip_path ?? null,
      zip_sha256: data.zip_sha256 ?? null,
      zip_bytes: data.zip_bytes ?? null,
    };
    if (data.id) row.id = data.id;
    const { data: result, error } = await (context.supabase as any)
      .from("platform_releases")
      .upsert(row, { onConflict: "id" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: result.id as string };
  });

export const publishRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("platform_releases")
      .update({ published_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unpublishRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("platform_releases")
      .update({ published_at: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: existing } = await (context.supabase as any)
      .from("platform_releases")
      .select("zip_path")
      .eq("id", data.id)
      .maybeSingle();
    if (existing?.zip_path) {
      await context.supabase.storage.from("network-releases").remove([existing.zip_path]);
    }
    const { error } = await (context.supabase as any)
      .from("platform_releases")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getReleaseDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rel, error: rerr } = await (context.supabase as any)
      .from("platform_releases")
      .select("zip_path")
      .eq("id", data.id)
      .maybeSingle();
    if (rerr) throw new Error(rerr.message);
    if (!rel?.zip_path) throw new Error("Release has no uploaded ZIP");
    const { data: signed, error: serr } = await context.supabase.storage
      .from("network-releases")
      .createSignedUrl(rel.zip_path, 60 * 10);
    if (serr || !signed?.signedUrl) throw new Error(serr?.message || "Failed to sign URL");
    return { url: signed.signedUrl };
  });
