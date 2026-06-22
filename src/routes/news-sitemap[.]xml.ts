import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://wkna49.com";
const PUBLICATION_NAME = "WKNA 49 News";

// Google News sitemap: only articles published in the last 48 hours.
// https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
export const Route = createFileRoute("/news-sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();
        const { data } = await supabase
          .from("posts")
          .select("slug, title, published_at")
          .eq("status", "published")
          .gte("published_at", cutoff)
          .order("published_at", { ascending: false })
          .limit(1000);

        const items = (data ?? [])
          .map((p: any) => {
            const pub = p.published_at ?? new Date().toISOString();
            return `  <url>
    <loc>${BASE_URL}/news/${p.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(PUBLICATION_NAME)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${new Date(pub).toISOString()}</news:publication_date>
      <news:title>${escapeXml(p.title)}</news:title>
    </news:news>
  </url>`;
          })
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items}
</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
