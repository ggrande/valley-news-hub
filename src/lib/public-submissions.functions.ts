// Rate-limited, error-captured public form submissions.
// Replaces direct client inserts to contact_submissions / news_tips / newsletters.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

function clamp(s: unknown, max: number): string {
  const v = typeof s === "string" ? s : "";
  return v.slice(0, max).trim();
}

function ipFromRequest(req: Request | undefined): string {
  if (!req) return "unknown";
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

async function withCapture<T>(kind: string, siteId: string | null, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    try {
      const { captureTenantError } = await import("@/lib/error-capture.server");
      await captureTenantError(siteId, kind, err);
    } catch { /* noop */ }
    throw err;
  }
}

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: {
    name?: string; email?: string; subject?: string; message?: string;
    managed_site_id?: string | null;
  }) => input)
  .handler(async ({ data }) => {
    const siteId = data.managed_site_id ?? null;
    const name = clamp(data.name, 200);
    const email = clamp(data.email, 320);
    const subject = clamp(data.subject, 300);
    const message = clamp(data.message, 8000);
    if (!name || !email || !subject || !message) throw new Error("All fields are required");

    return withCapture("contact_submit", siteId, async () => {
      const { enforceRateLimit } = await import("@/lib/rate-limit.server");
      const ip = ipFromRequest(getRequest());
      await enforceRateLimit({ scope: "contact", key: `${ip}|${email}`, siteId });

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await (supabaseAdmin as any).from("contact_submissions").insert({
        name, email, subject, message,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    });
  });

export const submitNewsTip = createServerFn({ method: "POST" })
  .inputValidator((input: {
    name?: string; email?: string; location?: string; category?: string;
    details?: string; managed_site_id?: string | null;
  }) => input)
  .handler(async ({ data }) => {
    const siteId = data.managed_site_id ?? null;
    const details = clamp(data.details, 8000);
    if (!details) throw new Error("Tip details are required");
    const name = clamp(data.name, 200);
    const email = clamp(data.email, 320);
    const location = clamp(data.location, 200);
    const category = clamp(data.category, 100);
    const summary = details.slice(0, 200);

    return withCapture("news_tip_submit", siteId, async () => {
      const { enforceRateLimit } = await import("@/lib/rate-limit.server");
      const ip = ipFromRequest(getRequest());
      await enforceRateLimit({ scope: "contact", key: `tip|${ip}|${email}`, siteId });

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await (supabaseAdmin as any).from("news_tips").insert({
        name: name || null, email: email || null, location: location || null,
        category: category || null, summary, details,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    });
  });

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((input: { email?: string; managed_site_id?: string | null }) => input)
  .handler(async ({ data }) => {
    const siteId = data.managed_site_id ?? null;
    const email = clamp(data.email, 320);
    if (!email || !/@/.test(email)) throw new Error("A valid email is required");

    return withCapture("newsletter_subscribe", siteId, async () => {
      const { enforceRateLimit } = await import("@/lib/rate-limit.server");
      const ip = ipFromRequest(getRequest());
      await enforceRateLimit({ scope: "newsletter", key: `${ip}|${email}`, siteId });

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await (supabaseAdmin as any)
        .from("newsletters")
        .insert({ email });
      if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
      return { ok: true };
    });
  });
