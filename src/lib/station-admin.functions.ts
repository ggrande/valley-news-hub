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
    return {
      displayName: site.display_name,
      tagline: site.directory_tagline ?? "",
      logoUrl: site.directory_logo_url ?? "",
      websiteUrl: site.directory_website_url ?? "",
      subdomain: site.subdomain,
      customDomain: site.custom_domain,
    };
  });

export const updateStationBranding = createServerFn({ method: "POST" })
  .inputValidator((d: {
    siteId: string;
    displayName: string;
    tagline?: string;
    logoUrl?: string;
    websiteUrl?: string;
  }) => d)
  .handler(async ({ data }) => {
    const { site } = await requireSession(data.siteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("managed_sites")
      .update({
        display_name: data.displayName.trim().slice(0, 120),
        directory_tagline: (data.tagline ?? "").slice(0, 240) || null,
        directory_logo_url: (data.logoUrl ?? "").slice(0, 500) || null,
        directory_website_url: (data.websiteUrl ?? "").slice(0, 500) || null,
      })
      .eq("id", site.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
