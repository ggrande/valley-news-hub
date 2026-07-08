// Server-only sliding-window rate limiter backed by rate_limit_events.
// Usage:
//   await enforceRateLimit({ scope: "magic-link", key: ip, siteId, perMinute: 5, perHour: 20 });
// Throws RateLimitError on violation. Records the attempt on success.
import { createHash } from "node:crypto";

export class RateLimitError extends Error {
  constructor(public window: "minute" | "hour" | "day", public limit: number) {
    super(`Too many requests. Try again shortly. (limit ${limit}/${window})`);
    this.name = "RateLimitError";
  }
}

export function hashKey(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

export interface RateLimitOpts {
  scope: string;
  key: string;
  siteId?: string | null;
  perMinute?: number;
  perHour?: number;
  perDay?: number;
}

// Sensible per-scope defaults if the caller doesn't override.
const DEFAULTS: Record<string, { perMinute: number; perHour: number; perDay?: number }> = {
  "magic-link":  { perMinute: 3,  perHour: 15,  perDay: 40  },
  "contact":     { perMinute: 3,  perHour: 20,  perDay: 60  },
  "comment":     { perMinute: 6,  perHour: 60           },
  "abuse":       { perMinute: 3,  perHour: 15,  perDay: 30 },
  "newsletter":  { perMinute: 3,  perHour: 15,  perDay: 40 },
  "default":     { perMinute: 10, perHour: 120          },
};

async function windowCount(admin: any, scope: string, key: string, sinceIso: string): Promise<number> {
  const { count } = await admin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("scope", scope)
    .eq("key", key)
    .gte("occurred_at", sinceIso);
  return count ?? 0;
}

export async function enforceRateLimit(opts: RateLimitOpts): Promise<void> {
  const defaults = DEFAULTS[opts.scope] ?? DEFAULTS.default;
  const perMinute = opts.perMinute ?? defaults.perMinute;
  const perHour = opts.perHour ?? defaults.perHour;
  const perDay = opts.perDay ?? defaults.perDay;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const key = hashKey(opts.key);
  const now = Date.now();

  const checks: Promise<void>[] = [];
  checks.push(
    windowCount(supabaseAdmin, opts.scope, key, new Date(now - 60_000).toISOString()).then((n) => {
      if (n >= perMinute) throw new RateLimitError("minute", perMinute);
    }),
    windowCount(supabaseAdmin, opts.scope, key, new Date(now - 3600_000).toISOString()).then((n) => {
      if (n >= perHour) throw new RateLimitError("hour", perHour);
    }),
  );
  if (perDay) {
    checks.push(
      windowCount(supabaseAdmin, opts.scope, key, new Date(now - 86400_000).toISOString()).then((n) => {
        if (n >= perDay!) throw new RateLimitError("day", perDay!);
      }),
    );
  }
  await Promise.all(checks);

  await (supabaseAdmin as any).from("rate_limit_events").insert({
    scope: opts.scope,
    key,
    managed_site_id: opts.siteId ?? null,
  });
}

export function callerIp(request: Request | undefined): string {
  if (!request) return "unknown";
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
