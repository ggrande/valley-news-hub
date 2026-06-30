// Server-only helpers to read tenant-authored posts from a station's
// own provisioned Supabase project. Used by the network feed and the
// tenant article route to surface local posts alongside the master feed.
import { decryptSecret } from "@/lib/tenant-crypto.server";
import { createClient } from "@supabase/supabase-js";

export type TenantSiteRow = {
  id: string;
  supabase_project_url: string | null;
  supabase_service_key_enc: string | null;
  supabase_service_key_iv: string | null;
};

export type LocalPost = {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  cover_url: string | null;
  published: boolean;
  published_at: string | null;
  updated_at: string | null;
};

function tenantClientFor(site: TenantSiteRow) {
  if (!site.supabase_project_url || !site.supabase_service_key_enc || !site.supabase_service_key_iv) {
    return null;
  }
  try {
    const key = decryptSecret(site.supabase_service_key_enc, site.supabase_service_key_iv);
    return createClient(site.supabase_project_url, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
  } catch {
    return null;
  }
}

export async function listLocalPublishedPosts(site: TenantSiteRow, limit = 30): Promise<LocalPost[]> {
  const t = tenantClientFor(site);
  if (!t) return [];
  try {
    const { data, error } = await t
      .from("posts")
      .select("id, slug, title, body, cover_url, published, published_at, updated_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as LocalPost[];
  } catch {
    return [];
  }
}

export async function getLocalPostBySlug(site: TenantSiteRow, slug: string): Promise<LocalPost | null> {
  const t = tenantClientFor(site);
  if (!t) return null;
  try {
    const { data, error } = await t
      .from("posts")
      .select("id, slug, title, body, cover_url, published, published_at, updated_at")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    if (error) return null;
    return (data as LocalPost) ?? null;
  } catch {
    return null;
  }
}
