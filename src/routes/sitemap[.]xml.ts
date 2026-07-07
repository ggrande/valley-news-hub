import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { ensureWebStoryUploaded, publicStoryUrl } from "@/lib/web-story.server";

const MASTER_BASE_URL = "https://wkna49.com";

function normalizeHost(h: string | null | undefined): string | null {
  if (!h) return null;
  return h.split(":")[0].toLowerCase();
}

function isMasterHost(host: string): boolean {
  return (
    host === "wkna49.com" ||
    host === "www.wkna49.com" ||
    host === "network.wkna49.com" ||
    host === "localhost" ||
    host.startsWith("127.") ||
    host.endsWith(".lovable.app")
  );
}

async function resolveTenantByHost(host: string) {
  const sub = host.endsWith(".wkna49.com") ? host.replace(/\.wkna49\.com$/, "") : null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = (supabaseAdmin as any)
    .from("managed_sites")
    .select("id, subdomain, custom_domain, custom_domain_status, network_sync_enabled, status, supabase_project_url, supabase_service_key_enc, supabase_service_key_iv");
  if (sub) {
    q = q.or(
      `subdomain.eq.${sub},and(custom_domain.eq.${host},custom_domain_status.eq.verified)`,
    );
  } else {
    q = q.eq("custom_domain", host).eq("custom_domain_status", "verified");
  }
  const { data: row } = await q.maybeSingle();
  if (!row || row.status === "suspended") return null;
  return row;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = normalizeHost(request.headers.get("host")) ?? "wkna49.com";
        const scheme = request.headers.get("x-forwarded-proto") ?? "https";

        // ---- Tenant host: per-station sitemap ----
        if (!isMasterHost(host)) {
          const tenant = await resolveTenantByHost(host);
          if (!tenant) return new Response("Not found", { status: 404 });
          const tenantBase = `${scheme}://${host}`;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const staticPaths = ["/", "/news", "/weather", "/sports", "/shows", "/watch-live", "/about", "/contact"];
          const urls: string[] = staticPaths.map(
            (p) => `  <url><loc>${tenantBase}${p}</loc><changefreq>weekly</changefreq></url>`,
          );

          // Network master posts (minus tenant-hidden) — this is what the
          // tenant actually renders at /news/{slug}.
          if (tenant.network_sync_enabled !== false) {
            const { data: hides } = await (supabaseAdmin as any)
              .from("tenant_hidden_network_posts")
              .select("post_id")
              .eq("site_id", tenant.id);
            const hidden = new Set((hides ?? []).map((h: any) => h.post_id as string));
            const { data: posts } = await (supabaseAdmin as any)
              .from("posts")
              .select("id, slug, published_at, updated_at")
              .eq("status", "published")
              .order("published_at", { ascending: false })
              .limit(2000);
            for (const p of (posts ?? []) as any[]) {
              if (hidden.has(p.id)) continue;
              const lastmod = (p.updated_at ?? p.published_at ?? "").slice(0, 10);
              urls.push(
                `  <url><loc>${tenantBase}/news/${p.slug}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>daily</changefreq></url>`,
              );
            }
          }

          // Tenant-local posts from the station's own DB.
          try {
            const { listLocalPublishedPosts } = await import("@/lib/tenant-local-posts.server");
            const local = await listLocalPublishedPosts(tenant as any, 500);
            for (const p of local) {
              const lastmod = (p.updated_at ?? p.published_at ?? "").slice(0, 10);
              urls.push(
                `  <url><loc>${tenantBase}/news/${p.slug}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>daily</changefreq></url>`,
              );
            }
          } catch {
            // tenant DB unreachable — omit local rows
          }

          const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
          return new Response(xml, {
            headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=600" },
          });
        }

        // ---- Master host: existing behavior ----
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: posts } = await supabase
          .from("posts")
          .select("slug, published_at, updated_at")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(5000);

        const staticPaths = [
          "/", "/news", "/news/local", "/weather", "/weather/closings", "/sports", "/watch-live",
          "/community", "/shows", "/about", "/submit-news-tip", "/contact",
          "/advertise", "/careers", "/corrections-policy", "/privacy-policy",
          "/terms-of-use", "/accessibility", "/public-file", "/rss.xml",
        ];
        const recent = (posts ?? []).slice(0, 25);

        const storyEntries = await Promise.all(
          recent.map(async (p: any) => {
            const lastmod = (p.updated_at ?? p.published_at ?? "").slice(0, 10);
            let loc = publicStoryUrl(p.slug);
            try {
              const { data: full } = await supabase
                .from("posts")
                .select("slug, title, dek, body, published_at, updated_at, featured_image, seo_description, author:authors(name), category:categories(name)")
                .eq("slug", p.slug)
                .eq("status", "published")
                .maybeSingle();
              if (full) loc = await ensureWebStoryUploaded(full as any);
            } catch (err) {
              console.error("[sitemap] story upload failed", p.slug, err);
            }
            return `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>weekly</changefreq></url>`;
          }),
        );

        const urls = [
          ...staticPaths.map((p) => `  <url><loc>${MASTER_BASE_URL}${p}</loc><changefreq>weekly</changefreq></url>`),
          ...(posts ?? []).map((p: any) => {
            const lastmod = (p.updated_at ?? p.published_at ?? "").slice(0, 10);
            return `  <url><loc>${MASTER_BASE_URL}/news/${p.slug}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>daily</changefreq></url>`;
          }),
          ...storyEntries,
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=600" },
        });
      },
    },
  },
});
