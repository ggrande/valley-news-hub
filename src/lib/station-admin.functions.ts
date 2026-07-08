// Station Admin server functions.
// Authorize via the wkna_station_sess cookie (set by tenant-auth.functions),
// then talk to the tenant's own provisioned Supabase project using the
// decrypted service_role key. No Supabase JWT required.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

const COOKIE = "wkna_station_sess";

async function sha256Hex(input: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const [k, ...v] = part.split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

type SiteRow = {
  id: string;
  display_name: string;
  subdomain: string;
  custom_domain: string | null;
  owner_email: string;
  directory_tagline: string | null;
  directory_logo_url: string | null;
  directory_website_url: string | null;
  network_sync_enabled: boolean;
  supabase_project_ref: string | null;
  supabase_project_url: string | null;
  supabase_service_key_enc: string | null;
  supabase_service_key_iv: string | null;
  supabase_anon_key_enc: string | null;
  supabase_anon_key_iv: string | null;
  provision_state: string;
};

async function requireSession(siteId: string): Promise<{ email: string; site: SiteRow }> {
  const req = getRequest();
  const token = parseCookie(req?.headers.get("cookie") ?? null, COOKIE);
  if (!token) throw new Error("Not signed in");
  const sessionHash = await sha256Hex(token);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sess } = await (supabaseAdmin as any)
    .from("tenant_admin_sessions")
    .select("email, expires_at, revoked_at")
    .eq("session_hash", sessionHash)
    .maybeSingle();
  if (!sess || sess.revoked_at || new Date(sess.expires_at).getTime() < Date.now()) {
    throw new Error("Session expired");
  }
  const { data: site } = await (supabaseAdmin as any)
    .from("managed_sites")
    .select("*")
    .eq("id", siteId)
    .ilike("owner_email", sess.email)
    .maybeSingle();
  if (!site) throw new Error("Station not found or access denied");
  return { email: sess.email, site: site as SiteRow };
}

async function tenantClient(site: SiteRow) {
  if (!site.supabase_project_url || !site.supabase_service_key_enc || !site.supabase_service_key_iv) {
    throw new Error("Tenant Supabase isn't fully provisioned yet");
  }
  const { decryptSecret } = await import("@/lib/tenant-crypto.server");
  const { createClient } = await import("@supabase/supabase-js");
  const key = decryptSecret(site.supabase_service_key_enc, site.supabase_service_key_iv);
  return createClient(site.supabase_project_url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || `post-${Date.now()}`;
}

// ---------- STATS ----------
export const getStationStats = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const t = await tenantClient(site);
    const safe = async (q: any) => {
      try { const { count } = await q; return count ?? 0; } catch { return 0; }
    };
    const [posts, published, drafts, comments, pending] = await Promise.all([
      safe(t.from("posts").select("*", { count: "exact", head: true })),
      safe(t.from("posts").select("*", { count: "exact", head: true }).eq("published", true)),
      safe(t.from("posts").select("*", { count: "exact", head: true }).eq("published", false)),
      safe(t.from("comments").select("*", { count: "exact", head: true })),
      safe(t.from("comments").select("*", { count: "exact", head: true }).eq("status", "pending")),
    ]);
    return { posts, published, drafts, comments, pendingComments: pending };
  });

// ---------- POSTS ----------
export const listStationPosts = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; limit?: number }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const t = await tenantClient(site);
    const { data: rows, error } = await t.from("posts")
      .select("id, slug, title, published, published_at, updated_at, cover_url")
      .order("updated_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return { posts: rows ?? [] };
  });

export const getStationPost = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const t = await tenantClient(site);
    const { data: row, error } = await t.from("posts").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return { post: row };
  });

export const upsertStationPost = createServerFn({ method: "POST" })
  .inputValidator((d: {
    siteId: string;
    id?: string;
    title: string;
    body: string;
    cover_url?: string | null;
    slug?: string;
    published: boolean;
  }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const t = await tenantClient(site);
    const slug = (data.slug || slugify(data.title));
    const payload: any = {
      title: data.title.trim(),
      body: data.body,
      cover_url: data.cover_url || null,
      slug,
      published: data.published,
      published_at: data.published ? new Date().toISOString() : null,
    };
    if (data.id) {
      const { data: row, error } = await t.from("posts").update(payload).eq("id", data.id).select().maybeSingle();
      if (error) throw new Error(error.message);
      return { post: row };
    }
    const { data: row, error } = await t.from("posts").insert(payload).select().maybeSingle();
    if (error) throw new Error(error.message);
    return { post: row };
  });

export const deleteStationPost = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const t = await tenantClient(site);
    const { error } = await t.from("posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- COMMENTS ----------
export const listStationComments = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; status?: "pending" | "approved" | "rejected" | "all" }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const t = await tenantClient(site);
    let q = t.from("comments").select("id, post_id, author_name, body, status, created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) {
      if (/relation .* does not exist/i.test(error.message)) {
        return { comments: [], missingTable: true };
      }
      throw new Error(error.message);
    }
    return { comments: rows ?? [], missingTable: false };
  });

export const setStationCommentStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; id: string; status: "approved" | "rejected" | "pending" }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const t = await tenantClient(site);
    const { error } = await t.from("comments").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStationComment = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const t = await tenantClient(site);
    const { error } = await t.from("comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- BRANDING ----------
export const getStationBranding = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: extra } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select("zip_code, latitude, longitude, contact_email, contact_phone, directory_city, directory_region")
      .eq("id", site.id)
      .maybeSingle();
    return {
      displayName: site.display_name,
      tagline: site.directory_tagline ?? "",
      logoUrl: site.directory_logo_url ?? "",
      websiteUrl: site.directory_website_url ?? "",
      subdomain: site.subdomain,
      customDomain: site.custom_domain,
      zipCode: (extra?.zip_code ?? "") as string,
      contactEmail: (extra?.contact_email ?? "") as string,
      contactPhone: (extra?.contact_phone ?? "") as string,
      city: (extra?.directory_city ?? "") as string,
      region: (extra?.directory_region ?? "") as string,
      latitude: extra?.latitude ?? null,
      longitude: extra?.longitude ?? null,
    };
  });

// Resolve a US zip code via Zippopotam (free, no key).
async function resolveZip(zip: string): Promise<{ city: string; region: string; lat: number; lon: number } | null> {
  const z = (zip || "").trim();
  if (!/^\d{5}$/.test(z)) return null;
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${z}`);
    if (!r.ok) return null;
    const j: any = await r.json();
    const place = j?.places?.[0];
    if (!place) return null;
    return {
      city: String(place["place name"] ?? ""),
      region: String(place["state abbreviation"] ?? ""),
      lat: parseFloat(place.latitude),
      lon: parseFloat(place.longitude),
    };
  } catch {
    return null;
  }
}

export const updateStationBranding = createServerFn({ method: "POST" })
  .inputValidator((d: {
    siteId: string;
    displayName: string;
    tagline?: string;
    logoUrl?: string;
    websiteUrl?: string;
    zipCode?: string;
    contactEmail?: string;
    contactPhone?: string;
  }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const update: Record<string, any> = {
      display_name: data.displayName.trim().slice(0, 120),
      directory_tagline: (data.tagline ?? "").slice(0, 240) || null,
      directory_logo_url: (data.logoUrl ?? "").slice(0, 500) || null,
      directory_website_url: (data.websiteUrl ?? "").slice(0, 500) || null,
      contact_email: (data.contactEmail ?? "").trim().slice(0, 200) || null,
      contact_phone: (data.contactPhone ?? "").trim().slice(0, 40) || null,
    };
    const zip = (data.zipCode ?? "").trim();
    if (zip) {
      update.zip_code = zip.slice(0, 10);
      const geo = await resolveZip(zip);
      if (geo) {
        update.latitude = geo.lat;
        update.longitude = geo.lon;
        update.directory_city = geo.city;
        update.directory_region = geo.region;
      }
    } else {
      update.zip_code = null;
    }
    const { error } = await (supabaseAdmin as any)
      .from("managed_sites")
      .update(update)
      .eq("id", site.id);
    if (error) throw new Error(error.message);
    return { ok: true, resolved: !!update.latitude };
  });


// ---------- BILLING (Stripe) ----------
async function findPurchase(siteId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Prefer linking through managed_sites -> stripe_subscription_id
  const { data: site } = await (supabaseAdmin as any)
    .from("managed_sites")
    .select("id, stripe_subscription_id, purchase_id, owner_email")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return null;
  let purchase: any = null;
  if (site.purchase_id) {
    const { data } = await (supabaseAdmin as any)
      .from("network_purchases")
      .select("stripe_customer_id, stripe_subscription_id, status, tier, environment, amount_cents, currency, created_at")
      .eq("id", site.purchase_id).maybeSingle();
    purchase = data;
  }
  if (!purchase && site.stripe_subscription_id) {
    const { data } = await (supabaseAdmin as any)
      .from("network_purchases")
      .select("stripe_customer_id, stripe_subscription_id, status, tier, environment, amount_cents, currency, created_at")
      .eq("stripe_subscription_id", site.stripe_subscription_id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    purchase = data;
  }
  if (!purchase) {
    const { data } = await (supabaseAdmin as any)
      .from("network_purchases")
      .select("stripe_customer_id, stripe_subscription_id, status, tier, environment, amount_cents, currency, created_at")
      .ilike("email", site.owner_email)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    purchase = data;
  }
  return purchase;
}

export const getStationBilling = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data }) => {
    await requireSession(data.siteId);
    const p = await findPurchase(data.siteId);
    if (!p) return { hasBilling: false as const };
    return {
      hasBilling: true as const,
      tier: p.tier as string,
      status: p.status as string,
      environment: p.environment as "sandbox" | "live",
      hasSubscription: !!p.stripe_subscription_id,
      hasCustomer: !!p.stripe_customer_id,
      amountCents: p.amount_cents as number | null,
      currency: p.currency as string | null,
      since: p.created_at as string | null,
    };
  });

export const createStationBillingPortal = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; returnUrl: string }) => d)
  .handler(async ({ data }): Promise<{ url: string } | { error: string }> => {
    await requireSession(data.siteId);
    const p = await findPurchase(data.siteId);
    if (!p?.stripe_customer_id) {
      return { error: "No Stripe customer is linked to this station yet." };
    }
    try {
      const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
      const stripe = createStripeClient(p.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: p.stripe_customer_id,
        return_url: data.returnUrl,
      });
      return { url: portal.url };
    } catch (e) {
      const { getStripeErrorMessage } = await import("@/lib/stripe.server");
      return { error: getStripeErrorMessage(e) };
    }
  });

// ---------- CUSTOM DOMAIN ----------
const CNAME_TARGET = "network.wkna49.com";
const TXT_PREFIX = "wkna49-verify=";

function normalizeHostname(input: string): string | null {
  const h = (input || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!h) return null;
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(h)) return null;
  if (h.endsWith(".wkna49.com") || h === "wkna49.com") return null;
  if (h.endsWith(".lovable.app")) return null;
  return h;
}

async function dohLookup(name: string, type: "TXT" | "CNAME" | "A"): Promise<string[]> {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
    });
    if (!r.ok) return [];
    const j: any = await r.json();
    const answers: any[] = j?.Answer ?? [];
    return answers.map((a) => String(a.data ?? "").replace(/^"|"$/g, "").replace(/"\s+"/g, ""));
  } catch {
    return [];
  }
}

function buildDomainPayload(site: SiteRow & Record<string, any>) {
  const domain = site.custom_domain;
  const token: string | null = site.custom_domain_verify_token ?? null;
  return {
    customDomain: domain,
    status: (site.custom_domain_status ?? "unset") as string,
    verifiedAt: site.custom_domain_verified_at ?? null,
    lastCheckedAt: site.custom_domain_last_checked_at ?? null,
    lastError: site.custom_domain_last_error ?? null,
    instructions: domain && token
      ? {
          cname: { name: domain, target: CNAME_TARGET },
          txt: { name: `_wkna49-verify.${domain}`, value: `${TXT_PREFIX}${token}` },
        }
      : null,
  };
}

export const getStationDomain = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select("custom_domain, custom_domain_status, custom_domain_verify_token, custom_domain_verified_at, custom_domain_last_checked_at, custom_domain_last_error")
      .eq("id", site.id)
      .maybeSingle();
    return buildDomainPayload({ ...site, ...(row ?? {}) } as any);
  });

export const setStationCustomDomain = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; domain: string }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const host = normalizeHostname(data.domain);
    if (!host) throw new Error("Enter a valid domain like news.example.com");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Make sure no other site already owns this domain
    const { data: taken } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select("id")
      .eq("custom_domain", host)
      .neq("id", site.id)
      .maybeSingle();
    if (taken) throw new Error("That domain is already attached to another station.");

    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(16).toString("hex");
    const { error } = await (supabaseAdmin as any)
      .from("managed_sites")
      .update({
        custom_domain: host,
        custom_domain_verify_token: token,
        custom_domain_status: "pending",
        custom_domain_verified_at: null,
        custom_domain_last_checked_at: null,
        custom_domain_last_error: null,
      })
      .eq("id", site.id);
    if (error) throw new Error(error.message);

    const { data: row } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select("custom_domain, custom_domain_status, custom_domain_verify_token, custom_domain_verified_at, custom_domain_last_checked_at, custom_domain_last_error")
      .eq("id", site.id)
      .maybeSingle();
    return buildDomainPayload({ ...site, ...(row ?? {}) } as any);
  });

export const clearStationCustomDomain = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("managed_sites")
      .update({
        custom_domain: null,
        custom_domain_verify_token: null,
        custom_domain_status: "unset",
        custom_domain_verified_at: null,
        custom_domain_last_checked_at: null,
        custom_domain_last_error: null,
      })
      .eq("id", site.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verifyStationCustomDomain = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select("custom_domain, custom_domain_verify_token")
      .eq("id", site.id)
      .maybeSingle();
    const domain: string | null = row?.custom_domain ?? null;
    const token: string | null = row?.custom_domain_verify_token ?? null;
    if (!domain || !token) throw new Error("Set a custom domain first.");

    const expectedTxt = `${TXT_PREFIX}${token}`;
    const [txtRecords, cnameRecords, aRecords] = await Promise.all([
      dohLookup(`_wkna49-verify.${domain}`, "TXT"),
      dohLookup(domain, "CNAME"),
      dohLookup(domain, "A"),
    ]);

    const txtOk = txtRecords.some((v) => v === expectedTxt);
    const cnameOk = cnameRecords.some((v) =>
      v.replace(/\.$/, "").toLowerCase() === CNAME_TARGET.toLowerCase(),
    );
    // Fallback: a records that resolve wkna49 infra are ok too
    const hasA = aRecords.length > 0;

    const now = new Date().toISOString();
    let status: string;
    let error: string | null = null;

    if (txtOk && (cnameOk || hasA)) {
      status = "verified";
    } else {
      status = "failed";
      const missing: string[] = [];
      if (!txtOk) missing.push(`TXT _wkna49-verify.${domain} = ${expectedTxt}`);
      if (!cnameOk && !hasA) missing.push(`CNAME ${domain} → ${CNAME_TARGET}`);
      error = `DNS not ready. Missing: ${missing.join(" · ")}`;
    }

    const { error: uerr } = await (supabaseAdmin as any)
      .from("managed_sites")
      .update({
        custom_domain_status: status,
        custom_domain_verified_at: status === "verified" ? now : null,
        custom_domain_last_checked_at: now,
        custom_domain_last_error: error,
      })
      .eq("id", site.id);
    if (uerr) throw new Error(uerr.message);

    return {
      ok: status === "verified",
      status,
      error,
      checked: { txt: txtRecords, cname: cnameRecords, a: aRecords },
    };
  });

// ---------- MEDIA (tenant-scoped uploads) ----------
// Media is stored in the master `news-media` bucket under `tenant/<siteId>/…`
// and served through the existing `/api/media?p=…` streamer. This avoids
// touching each tenant's Supabase storage while keeping URLs stable.
const MEDIA_PREFIX = "tenant";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function extForMime(m: string) {
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/gif") return "gif";
  return "jpg";
}

export const uploadStationMedia = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; filename: string; contentType: string; dataBase64: string }) => d)
  .handler(async ({ data }): Promise<{ url: string; path: string }> => {
    const { site } = await requireSession(data.siteId);
    if (!ALLOWED_MIME.has(data.contentType)) {
      throw new Error("Unsupported file type. Use PNG, JPEG, WebP, or GIF.");
    }
    const bytes = Uint8Array.from(atob(data.dataBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error(`File too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB).`);
    }
    const safe = slugify(data.filename.replace(/\.[^.]+$/, ""));
    const ext = extForMime(data.contentType);
    const path = `${MEDIA_PREFIX}/${site.id}/${Date.now()}-${safe}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).storage
      .from("news-media")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (error) throw new Error(error.message);
    return { url: `/api/media?p=${encodeURIComponent(path)}`, path };
  });

export const listStationMedia = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const prefix = `${MEDIA_PREFIX}/${site.id}`;
    const { data: rows, error } = await (supabaseAdmin as any).storage
      .from("news-media")
      .list(prefix, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw new Error(error.message);
    return {
      items: (rows ?? [])
        .filter((r: any) => r?.name && !r.name.endsWith("/"))
        .map((r: any) => {
          const p = `${prefix}/${r.name}`;
          return {
            path: p,
            name: r.name,
            size: r.metadata?.size ?? null,
            createdAt: r.created_at ?? null,
            url: `/api/media?p=${encodeURIComponent(p)}`,
          };
        }),
    };
  });

export const deleteStationMedia = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; path: string }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const expected = `${MEDIA_PREFIX}/${site.id}/`;
    if (!data.path.startsWith(expected) || data.path.includes("..")) {
      throw new Error("Invalid media path");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).storage.from("news-media").remove([data.path]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- LEGAL PAGES ----------
export const getStationLegal = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select("legal_terms_md, legal_privacy_md, legal_dmca_md")
      .eq("id", site.id)
      .maybeSingle();
    const { boilerplate } = await import("@/lib/tenant-legal.functions");
    return {
      terms: (row?.legal_terms_md ?? "") as string,
      privacy: (row?.legal_privacy_md ?? "") as string,
      dmca: (row?.legal_dmca_md ?? "") as string,
      defaults: {
        terms: boilerplate("terms", site.display_name),
        privacy: boilerplate("privacy", site.display_name),
        dmca: boilerplate("dmca", site.display_name),
      },
    };
  });

export const updateStationLegal = createServerFn({ method: "POST" })
  .inputValidator((d: {
    siteId: string;
    kind: "terms" | "privacy" | "dmca";
    body: string;
  }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const col = data.kind === "terms" ? "legal_terms_md"
      : data.kind === "privacy" ? "legal_privacy_md"
      : data.kind === "dmca" ? "legal_dmca_md"
      : null;
    if (!col) throw new Error("Invalid kind");
    const body = (data.body ?? "").slice(0, 50_000);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("managed_sites")
      .update({ [col]: body.trim() ? body : null })
      .eq("id", site.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


