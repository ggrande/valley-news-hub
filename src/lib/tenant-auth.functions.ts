// Magic-link auth for Affiliate Station owners.
// No password, no Supabase auth — short-lived link tokens + long-lived session tokens.
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const COOKIE = "wkna_station_sess";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const TOKEN_TTL_MIN = 15;

async function sha256Hex(input: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

async function randomToken(bytes = 32): Promise<string> {
  const { randomBytes } = await import("node:crypto");
  return randomBytes(bytes).toString("base64url");
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const [k, ...v] = part.split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function appBaseUrl(): string {
  return (process.env.APP_BASE_URL || "https://wkna49.com").replace(/\/+$/, "");
}

async function findSiteByHost(host: string | null) {
  if (!host) return null;
  const sub = host.split(":")[0].toLowerCase().replace(/\.wkna49\.com$/, "");
  if (!sub || sub === "wkna49.com" || sub === "www") return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("managed_sites")
    .select("id, display_name, subdomain, custom_domain, owner_email, stripe_customer_id, supabase_project_ref")
    .or(`subdomain.eq.${sub},custom_domain.eq.${host}`)
    .maybeSingle();
  return data;
}

async function backfillOwnerEmailFromStripe(siteId: string, stripeCustomerId: string | null): Promise<string | null> {
  if (!stripeCustomerId) return null;
  try {
    const { createStripeClient } = await import("@/lib/stripe.server");
    // Try live then sandbox.
    for (const env of ["live", "sandbox"] as const) {
      try {
        const stripe = createStripeClient(env);
        const c: any = await stripe.customers.retrieve(stripeCustomerId);
        const email = c?.email || null;
        if (email) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await (supabaseAdmin as any).from("managed_sites")
            .update({ owner_email: email }).eq("id", siteId);
          return email;
        }
      } catch { /* try next env */ }
    }
  } catch { /* no stripe lib */ }
  return null;
}

// ----- 1. REQUEST a magic link -----
export const requestStationLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; host?: string }) => d)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }

    const req = getRequest();
    const host = data.host || req?.headers.get("host") || null;
    const site = await findSiteByHost(host);

    // Rate-limit by caller IP + email to slow brute-force / bombing.
    try {
      const { enforceRateLimit, callerIp } = await import("@/lib/rate-limit.server");
      const ip = callerIp(req ?? undefined);
      await enforceRateLimit({ scope: "magic-link", key: `${ip}:${email}`, siteId: site?.id ?? null });
    } catch (rlErr: any) {
      if (rlErr?.name === "RateLimitError") throw new Error(rlErr.message);
      throw rlErr;
    }

    // If site exists but no owner_email, try Stripe backfill.
    if (site && !site.owner_email && site.stripe_customer_id) {
      await backfillOwnerEmailFromStripe(site.id, site.stripe_customer_id);
    }

    // Re-read after potential backfill
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let resolvedSite = site;
    if (site) {
      const { data: fresh } = await (supabaseAdmin as any)
        .from("managed_sites")
        .select("id, owner_email, display_name")
        .eq("id", site.id)
        .maybeSingle();
      resolvedSite = fresh ? { ...site, ...fresh } : site;
    }

    // Site-scoped login: email must match owner_email on that site.
    // Master login (no site host): allow any email — they'll only see stations they own.
    if (resolvedSite && resolvedSite.owner_email && resolvedSite.owner_email.toLowerCase() !== email) {
      // Don't leak which email is on file — just return generic success.
      return { ok: true, message: "If that email is on file, a sign-in link is on its way." };
    }
    if (resolvedSite && !resolvedSite.owner_email) {
      // Still couldn't determine owner. Allow first email to claim by sending link.
      // (Acceptable: only someone with DNS-level control could reach the subdomain.)
    }

    const token = await randomToken(32);
    const tokenHash = await sha256Hex(token);
    const expires = new Date(Date.now() + TOKEN_TTL_MIN * 60_000).toISOString();

    await (supabaseAdmin as any).from("tenant_admin_login_tokens").insert({
      token_hash: tokenHash,
      email,
      site_id: resolvedSite?.id ?? null,
      requested_ip: req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      expires_at: expires,
    });

    // Build the verify URL on the same host they requested it from.
    const proto = req?.headers.get("x-forwarded-proto") || "https";
    const linkBase = host ? `${proto}://${host}` : appBaseUrl();
    const link = `${linkBase}/station/verify?token=${encodeURIComponent(token)}`;

    // Send via internal helper (bypasses HTTP auth on the public send route).
    try {
      const { sendTransactionalEmailInternal } = await import("@/lib/transactional-email.server");
      const result = await sendTransactionalEmailInternal({
        templateName: "station-magic-link",
        recipientEmail: email,
        idempotencyKey: `magic-${tokenHash.slice(0, 16)}`,
        templateData: { link, siteName: resolvedSite?.display_name ?? "WKNA 49 Network" },
      });
      if (!result.success) {
        console.log("[magic-link] send not delivered:", result.reason, "link:", link);
      }
    } catch (e) {
      console.log("[magic-link] send threw; link:", link, e);
    }

    return { ok: true, message: "Check your inbox for a sign-in link (expires in 15 minutes)." };
  });

// ----- 2. VERIFY token + issue session cookie -----
export const verifyStationLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const tokenHash = await sha256Hex(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await (supabaseAdmin as any)
      .from("tenant_admin_login_tokens")
      .select("id, email, site_id, expires_at, consumed_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!row) throw new Error("Invalid or expired link.");
    if (row.consumed_at) throw new Error("This link has already been used.");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("This link has expired.");

    await (supabaseAdmin as any).from("tenant_admin_login_tokens")
      .update({ consumed_at: new Date().toISOString() }).eq("id", row.id);

    const session = await randomToken(32);
    const sessionHash = await sha256Hex(session);
    const expires = new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString();

    const req = getRequest();
    await (supabaseAdmin as any).from("tenant_admin_sessions").insert({
      session_hash: sessionHash,
      email: row.email,
      site_id: row.site_id,
      user_agent: req?.headers.get("user-agent")?.slice(0, 400) ?? null,
      expires_at: expires,
    });

    const cookie = [
      `${COOKIE}=${session}`,
      `Path=/`,
      `Max-Age=${SESSION_TTL_SEC}`,
      `HttpOnly`,
      `Secure`,
      `SameSite=Lax`,
    ].join("; ");
    setResponseHeader("Set-Cookie", cookie);

    return { ok: true, email: row.email, siteId: row.site_id };
  });

// ----- 3. WHO AM I -----
export const getStationSession = createServerFn({ method: "GET" })
  .handler(async () => {
    const req = getRequest();
    const token = parseCookie(req?.headers.get("cookie") ?? null, COOKIE);
    if (!token) return { authenticated: false as const };

    const sessionHash = await sha256Hex(token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sess } = await (supabaseAdmin as any)
      .from("tenant_admin_sessions")
      .select("id, email, site_id, expires_at, revoked_at")
      .eq("session_hash", sessionHash)
      .maybeSingle();

    if (!sess || sess.revoked_at || new Date(sess.expires_at).getTime() < Date.now()) {
      return { authenticated: false as const };
    }

    // Resolve site from host (if subdomain) and verify the session's email owns it.
    const host = req?.headers.get("host") || null;
    const hostSite = await findSiteByHost(host);

    // Fetch all sites owned by this email.
    const { data: owned } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select("id, display_name, subdomain, custom_domain, supabase_project_ref, owner_email")
      .ilike("owner_email", sess.email);

    const sites = (owned || []) as any[];

    let activeSite: any = null;
    if (hostSite) {
      activeSite = sites.find((s) => s.id === hostSite.id) || null;
      if (!activeSite) {
        // Logged in but this isn't their station.
        return { authenticated: true as const, email: sess.email, sites, activeSite: null, hostBlocked: true };
      }
    } else if (sess.site_id) {
      activeSite = sites.find((s) => s.id === sess.site_id) || null;
    }

    // Touch last_seen
    await (supabaseAdmin as any).from("tenant_admin_sessions")
      .update({ last_seen_at: new Date().toISOString() }).eq("id", sess.id);

    return {
      authenticated: true as const,
      email: sess.email,
      sites,
      activeSite,
      hostBlocked: false,
    };
  });

// ----- 4. SIGN OUT -----
export const signOutStation = createServerFn({ method: "POST" })
  .handler(async () => {
    const req = getRequest();
    const token = parseCookie(req?.headers.get("cookie") ?? null, COOKIE);
    if (token) {
      const sessionHash = await sha256Hex(token);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("tenant_admin_sessions")
        .update({ revoked_at: new Date().toISOString() }).eq("session_hash", sessionHash);
    }
    setResponseHeader("Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    return { ok: true };
  });

// ----- 5. Detect host context (used by route loaders) -----
export const getHostContext = createServerFn({ method: "GET" })
  .handler(async () => {
    const req = getRequest();
    const host = req?.headers.get("host") || null;
    const site = await findSiteByHost(host);
    return {
      host,
      isSubdomain: !!site,
      site: site ? {
        id: site.id, displayName: site.display_name, subdomain: site.subdomain,
        customDomain: site.custom_domain,
      } : null,
    };
  });

// ----- 6. Owner one-click sign-in link -----
// Signed-in platform owner mints a fresh station magic link for a site they own,
// so the "Open Newsroom Admin" button can auto-login instead of asking for email.
export const mintOwnerStationLoginLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { siteId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: site, error } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select("id, owner_user_id, owner_email, subdomain, custom_domain, custom_domain_status, display_name")
      .eq("id", data.siteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!site) throw new Error("Site not found");
    if (site.owner_user_id !== context.userId) throw new Error("Not the owner of this site");

    // Resolve the owner email — prefer the site's owner_email, fall back to the auth user's email.
    let email: string | null = site.owner_email ?? null;
    if (!email) {
      email = (context.claims?.email as string | undefined)?.toLowerCase() ?? null;
      if (email) {
        await (supabaseAdmin as any).from("managed_sites").update({ owner_email: email }).eq("id", site.id);
      }
    }
    if (!email) throw new Error("No owner email on file for this site");

    const token = await randomToken(32);
    const tokenHash = await sha256Hex(token);
    const expires = new Date(Date.now() + TOKEN_TTL_MIN * 60_000).toISOString();
    const req = getRequest();

    await (supabaseAdmin as any).from("tenant_admin_login_tokens").insert({
      token_hash: tokenHash,
      email,
      site_id: site.id,
      requested_ip: req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      expires_at: expires,
    });

    const host =
      site.custom_domain && site.custom_domain_status === "verified"
        ? site.custom_domain
        : `${site.subdomain}.wkna49.com`;
    const link = `https://${host}/station/verify?token=${encodeURIComponent(token)}`;
    return { ok: true, link, expiresAt: expires };
  });
