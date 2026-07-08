// Per-tenant AI gate: quota enforcement, provider selection, usage logging.
// Server-only — always import inside a server handler.

export type AiOp = "post" | "image" | "other";

export interface TenantAiConfig {
  id: string;
  ai_mode: "lovable" | "disabled" | "byo_gemini";
  ai_provider_api_key_enc: string | null;
  ai_model: string | null;
  ai_posts_quota_per_min: number;
  ai_posts_quota_per_day: number;
  ai_posts_quota_per_month: number;
  ai_images_quota_per_min: number;
  ai_images_quota_per_day: number;
  ai_images_quota_per_month: number;
}

const AI_COLUMNS =
  "id, ai_mode, ai_provider_api_key_enc, ai_model, " +
  "ai_posts_quota_per_min, ai_posts_quota_per_day, ai_posts_quota_per_month, " +
  "ai_images_quota_per_min, ai_images_quota_per_day, ai_images_quota_per_month";

export async function loadTenantAiConfig(admin: any, siteId: string): Promise<TenantAiConfig> {
  const { data, error } = await admin
    .from("managed_sites")
    .select(AI_COLUMNS)
    .eq("id", siteId)
    .maybeSingle();
  if (error || !data) throw new Error("Tenant AI config not found");
  return data as TenantAiConfig;
}

export class AiQuotaError extends Error {
  constructor(public window: "minute" | "day" | "month", public limit: number, message?: string) {
    super(message ?? `AI quota exceeded (${window} limit ${limit})`);
    this.name = "AiQuotaError";
  }
}

export class AiDisabledError extends Error {
  constructor() {
    super("AI is disabled for this station");
    this.name = "AiDisabledError";
  }
}

async function countUsage(admin: any, siteId: string, op: AiOp, sinceIso: string): Promise<number> {
  const { count } = await admin
    .from("tenant_ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("managed_site_id", siteId)
    .eq("op_type", op)
    .eq("succeeded", true)
    .gte("created_at", sinceIso);
  return count ?? 0;
}

export async function checkTenantAiQuota(admin: any, cfg: TenantAiConfig, op: AiOp): Promise<void> {
  if (cfg.ai_mode === "disabled") throw new AiDisabledError();
  const now = Date.now();
  const perMin = op === "image" ? cfg.ai_images_quota_per_min : cfg.ai_posts_quota_per_min;
  const perDay = op === "image" ? cfg.ai_images_quota_per_day : cfg.ai_posts_quota_per_day;
  const perMon = op === "image" ? cfg.ai_images_quota_per_month : cfg.ai_posts_quota_per_month;

  const [minCt, dayCt, monCt] = await Promise.all([
    countUsage(admin, cfg.id, op, new Date(now - 60_000).toISOString()),
    countUsage(admin, cfg.id, op, new Date(now - 24 * 3600_000).toISOString()),
    countUsage(admin, cfg.id, op, new Date(now - 30 * 24 * 3600_000).toISOString()),
  ]);
  if (minCt >= perMin) throw new AiQuotaError("minute", perMin);
  if (dayCt >= perDay) throw new AiQuotaError("day", perDay);
  if (monCt >= perMon) throw new AiQuotaError("month", perMon);
}

export async function recordTenantAiUsage(
  admin: any,
  cfg: TenantAiConfig,
  op: AiOp,
  opts: { model?: string | null; tokensIn?: number | null; tokensOut?: number | null; succeeded?: boolean; error?: string | null } = {},
): Promise<void> {
  try {
    await admin.from("tenant_ai_usage").insert({
      managed_site_id: cfg.id,
      op_type: op,
      ai_mode: cfg.ai_mode,
      model: opts.model ?? cfg.ai_model,
      tokens_in: opts.tokensIn ?? null,
      tokens_out: opts.tokensOut ?? null,
      succeeded: opts.succeeded ?? true,
      error_message: opts.error ?? null,
    });
  } catch (err) {
    console.warn("recordTenantAiUsage failed:", (err as Error)?.message);
  }
}

// Returns {gateway config} for AI SDK calls (OpenAI-compatible base + key headers).
// - lovable → Lovable AI Gateway with server LOVABLE_API_KEY
// - byo_gemini → OpenRouter-style Gemini via tenant key (google/*)
// - disabled → throws AiDisabledError before this is called
export async function getTenantAiProvider(cfg: TenantAiConfig): Promise<{
  baseURL: string;
  apiKey: string;
  authHeader: "Lovable-API-Key" | "Authorization";
  authValue: string;
  defaultModel: string;
}> {
  if (cfg.ai_mode === "disabled") throw new AiDisabledError();
  if (cfg.ai_mode === "byo_gemini") {
    if (!cfg.ai_provider_api_key_enc) throw new Error("Station has no Gemini API key configured");
    const [ivHex, ctHex] = cfg.ai_provider_api_key_enc.split(":");
    if (!ivHex || !ctHex) throw new Error("Malformed Gemini API key ciphertext");
    const { decryptSecret } = await import("@/lib/tenant-crypto.server");
    const apiKey = decryptSecret(ctHex, ivHex);
    return {
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey,
      authHeader: "Authorization",
      authValue: `Bearer ${apiKey}`,
      defaultModel: (cfg.ai_model ?? "gemini-2.5-flash").replace(/^google\//, ""),
    };
  }
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  return {
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    authHeader: "Lovable-API-Key",
    authValue: key,
    defaultModel: cfg.ai_model ?? "google/gemini-3-flash-preview",
  };
}

export async function encryptTenantApiKey(plain: string): Promise<string> {
  // Returns "iv:ciphertext" combined for single-column storage.
  const { encryptSecret } = await import("@/lib/tenant-crypto.server");
  const { ciphertext, iv } = encryptSecret(plain);
  return `${iv}:${ciphertext}`;
}
