import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://wkna49.com";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
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
        const recent = (posts ?? []).slice(0, 50);
        const urls = [
          ...staticPaths.map((p) => `  <url><loc>${BASE_URL}${p}</loc><changefreq>weekly</changefreq></url>`),
          ...(posts ?? []).map((p: any) => {
            const lastmod = (p.updated_at ?? p.published_at ?? "").slice(0, 10);
            return `  <url><loc>${BASE_URL}/news/${p.slug}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>daily</changefreq></url>`;
          }),
          ...recent.map((p: any) => {
            const lastmod = (p.updated_at ?? p.published_at ?? "").slice(0, 10);
            return `  <url><loc>${BASE_URL}/api/public/web-stories/${p.slug}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>weekly</changefreq></url>`;
          }),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=600" },
        });
      },
    },
  },
});
