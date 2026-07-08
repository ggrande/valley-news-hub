// Server-only helper: log structured tenant-side errors for admin observability.
// Fails silently — capture must never throw and never block the caller.
export async function captureTenantError(
  siteId: string | null,
  kind: string,
  err: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? null : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("tenant_error_events").insert({
      managed_site_id: siteId,
      kind,
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 8000) ?? null,
      context: context ? (context as any) : null,
    });
  } catch (e) {
    console.warn("captureTenantError failed:", (e as Error)?.message);
  }
}
