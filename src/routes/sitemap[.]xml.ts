import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { articles } from "@/lib/news-data";

const BASE_URL = "";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticPaths = [
          "/", "/news", "/news/local", "/weather", "/sports", "/watch-live",
          "/community", "/shows", "/about", "/submit-news-tip", "/contact",
          "/advertise", "/careers", "/corrections-policy", "/privacy-policy",
          "/terms-of-use", "/accessibility", "/public-file",
        ];
        const urls = [
          ...staticPaths.map((p) => `  <url><loc>${BASE_URL}${p}</loc><changefreq>weekly</changefreq></url>`),
          ...articles.map((a) => `  <url><loc>${BASE_URL}/news/${a.slug}</loc><lastmod>${a.date}</lastmod><changefreq>monthly</changefreq></url>`),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
