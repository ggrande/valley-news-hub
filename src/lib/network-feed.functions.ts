// Mixed-feed query for affiliate tenants: combines master WKNA 49 published
// posts with any tenant-local posts (future), minus per-tenant hidden rows.
// Also exposes the toggle/hide server fns used by tenant admins.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

const SESSION_COOKIE = "wkna_station_sess";

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const [k, ...v] = part.split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

async function sha256Hex(input: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

// Resolves the currently-signed-in tenant admin session and verifies they
// own the target site. Throws on failure.
async function requireTenantAdminFor(siteId: string): Promise<{ email: string }> {
  const req = getRequest();
  const token = parseCookie(req?.headers.get("cookie") ?? null, SESSION_COOKIE);
  if (!token) throw new Error("Not signed in.");
  const sessionHash = await sha256Hex(token);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sess } = await (supabaseAdmin as any)
    .from("tenant_admin_sessions")
    .select("id, email, expires_at, revoked_at")
    .eq("session_hash", sessionHash)
    .maybeSingle();
  if (!sess || sess.revoked_at || new Date(sess.expires_at).getTime() < Date.now()) {
    throw new Error("Session expired. Please sign in again.");
  }
  const { data: site } = await (supabaseAdmin as any)
    .from("managed_sites")
    .select("id, owner_email")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) throw new Error("Station not found.");
  if (site.owner_email && site.owner_email.toLowerCase() !== sess.email.toLowerCase()) {
    throw new Error("You don't have access to this station.");
  }
  return { email: sess.email };
}

const POST_SELECT =
  "id, slug, title, dek, body, status, published_at, updated_at, is_breaking, is_weather_alert, is_pinned, featured_image, hero_caption, seo_title, seo_description, og_image, category:categories(slug, name), author:authors(slug, name)";

export type FeedItem = {
  source: "network" | "local";
  id: string;
  slug: string;
  title: string;
  dek: string | null;
  published_at: string | null;
  updated_at: string | null;
  is_pinned: boolean;
  is_breaking: boolean;
  featured_image: string | null;
  category: { slug: string; name: string } | null;
  author: { slug: string; name: string } | null;
};

// Resolve a managed_site by its URL slug (stored in `subdomain`).
export const getTenantBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const slug = (data.slug || "").toLowerCase();
    if (!slug) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select(
        "id, display_name, subdomain, custom_domain, status, network_sync_enabled, directory_logo_url, directory_tagline, directory_city, directory_region, directory_website_url, zip_code, latitude, longitude, contact_email, contact_phone"
      )
      .eq("subdomain", slug)
      .maybeSingle();
    if (!row) return null;
    // Suspended tenants are returned so the layout can render a "station paused"
    // page instead of a raw 404. Content routes still short-circuit via `status`.


    return {
      siteId: row.id as string,
      slug: row.subdomain as string,
      displayName: row.display_name as string,
      customDomain: (row.custom_domain ?? null) as string | null,
      status: row.status as string,
      networkSyncEnabled: row.network_sync_enabled !== false,
      logoUrl: row.directory_logo_url ?? null,
      tagline: row.directory_tagline ?? null,
      city: row.directory_city ?? null,
      region: row.directory_region ?? null,
      websiteUrl: row.directory_website_url ?? null,
      zipCode: (row.zip_code ?? null) as string | null,
      latitude: (row.latitude ?? null) as number | null,
      longitude: (row.longitude ?? null) as number | null,
      contactEmail: (row.contact_email ?? null) as string | null,
      contactPhone: (row.contact_phone ?? null) as string | null,
    };
  });

// Mixed feed for a tenant site.
export const getTenantFeed = createServerFn({ method: "GET" })
  .inputValidator((d: { siteSlug: string; limit?: number; categorySlug?: string }) => d)
  .handler(async ({ data }): Promise<{ items: FeedItem[]; networkSyncEnabled: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: site } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select("id, network_sync_enabled, supabase_project_url, supabase_service_key_enc, supabase_service_key_iv")
      .eq("subdomain", data.siteSlug)
      .maybeSingle();
    if (!site) return { items: [], networkSyncEnabled: true };

    const networkSyncEnabled = site.network_sync_enabled !== false;
    const limit = Math.min(Math.max(data.limit ?? 30, 1), 100);
    const items: FeedItem[] = [];

    if (networkSyncEnabled) {
      // Hidden master post ids for this site.
      const { data: hides } = await (supabaseAdmin as any)
        .from("tenant_hidden_network_posts")
        .select("post_id")
        .eq("site_id", site.id);
      const hidden = new Set((hides ?? []).map((h: any) => h.post_id as string));

      let q = (supabaseAdmin as any)
        .from("posts")
        .select(POST_SELECT)
        .eq("status", "published")
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(limit + hidden.size);
      const { data: rows } = await q;
      for (const p of (rows ?? []) as any[]) {
        if (hidden.has(p.id)) continue;
        if (data.categorySlug && p.category?.slug !== data.categorySlug) continue;
        items.push({
          source: "network",
          id: p.id,
          slug: p.slug,
          title: p.title,
          dek: p.dek,
          published_at: p.published_at,
          updated_at: p.updated_at,
          is_pinned: !!p.is_pinned,
          is_breaking: !!p.is_breaking,
          featured_image: p.featured_image,
          category: p.category,
          author: p.author,
        });
        if (items.length >= limit) break;
      }
    }

    // Append tenant-local posts from the station's own Supabase project.
    try {
      const { listLocalPublishedPosts } = await import("@/lib/tenant-local-posts.server");
      const local = await listLocalPublishedPosts(site as any, limit);
      for (const p of local) {
        items.push({
          source: "local",
          id: p.id,
          slug: p.slug,
          title: p.title,
          dek: null,
          published_at: p.published_at,
          updated_at: p.updated_at,
          is_pinned: false,
          is_breaking: false,
          featured_image: p.cover_url,
          category: null,
          author: null,
        });
      }
    } catch {
      // Tenant DB unreachable — silently fall back to network items.
    }

    // Re-sort by published_at desc (pinned first stays for network items via earlier order).
    items.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      const ta = a.published_at ? Date.parse(a.published_at) : 0;
      const tb = b.published_at ? Date.parse(b.published_at) : 0;
      return tb - ta;
    });
    return { items: items.slice(0, limit), networkSyncEnabled };
  });

// Toggle the network sync for a tenant site.
export const setTenantNetworkSync = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; enabled: boolean }) => d)
  .handler(async ({ data }) => {
    await requireTenantAdminFor(data.siteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("managed_sites")
      .update({ network_sync_enabled: !!data.enabled })
      .eq("id", data.siteId);
    if (error) throw new Error(error.message);
    return { ok: true, enabled: !!data.enabled };
  });

// Hide a master post on this tenant.
export const hideNetworkPost = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; postId: string }) => d)
  .handler(async ({ data }) => {
    const { email } = await requireTenantAdminFor(data.siteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("tenant_hidden_network_posts")
      .upsert(
        { site_id: data.siteId, post_id: data.postId, hidden_by: null, hidden_at: new Date().toISOString() },
        { onConflict: "site_id,post_id" }
      );
    if (error) throw new Error(error.message);
    return { ok: true, by: email };
  });

export const unhideNetworkPost = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; postId: string }) => d)
  .handler(async ({ data }) => {
    await requireTenantAdminFor(data.siteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("tenant_hidden_network_posts")
      .delete()
      .eq("site_id", data.siteId)
      .eq("post_id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// List recent master posts with a hidden flag for this site (for admin UI).
export const listNetworkPostsForAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { siteId: string; limit?: number }) => d)
  .handler(async ({ data }) => {
    await requireTenantAdminFor(data.siteId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = Math.min(Math.max(data.limit ?? 50, 1), 200);
    const { data: posts } = await (supabaseAdmin as any)
      .from("posts")
      .select("id, slug, title, published_at, category:categories(name)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);
    const { data: hides } = await (supabaseAdmin as any)
      .from("tenant_hidden_network_posts")
      .select("post_id")
      .eq("site_id", data.siteId);
    const hidden = new Set((hides ?? []).map((h: any) => h.post_id as string));
    return {
      posts: (posts ?? []).map((p: any) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        published_at: p.published_at,
        category: p.category?.name ?? null,
        hidden: hidden.has(p.id),
      })),
    };
  });
