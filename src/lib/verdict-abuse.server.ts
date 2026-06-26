// Server-only helpers for fingerprint hashing, IP extraction, and Postgres-
// backed windowed rate limiting. Not imported by client code.
import { createHash, createHmac } from "node:crypto";

export function hashFingerprint(fp: string): string {
  const key = process.env.VERDICT_FINGERPRINT_SIGNING_KEY || "dev-only-key";
  return createHmac("sha256", key).update(fp).digest("hex");
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export function extractIp(req: Request | undefined): string {
  if (!req) return "0.0.0.0";
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  return req.headers.get("x-real-ip") || "0.0.0.0";
}

export async function rateLimit(
  supabaseAdmin: any,
  key: string,
  windowSec: number,
  max: number,
): Promise<{ ok: boolean; count: number }> {
  const bucket = new Date(
    Math.floor(Date.now() / (windowSec * 1000)) * windowSec * 1000,
  ).toISOString();
  const { data: existing } = await supabaseAdmin
    .from("verdict_rate_windows")
    .select("count")
    .eq("key", key)
    .eq("window_start", bucket)
    .maybeSingle();
  const next = (existing?.count ?? 0) + 1;
  if (existing) {
    await supabaseAdmin
      .from("verdict_rate_windows")
      .update({ count: next })
      .eq("key", key)
      .eq("window_start", bucket);
  } else {
    await supabaseAdmin
      .from("verdict_rate_windows")
      .insert({ key, window_start: bucket, count: 1 });
  }
  return { ok: next <= max, count: next };
}
