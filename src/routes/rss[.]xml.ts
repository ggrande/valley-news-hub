import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: posts } = await supabase
          .from("posts")
          .select("slug, title, dek, published_at, seo_description, featured_image, category:categories(name)")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(50);

        const origin = new URL(request.url).origin;
        const items = (posts ?? [])
          .map((p: any) => {
            const link = `${origin}/news/${p.slug}`;
            const desc = (p.seo_description ?? p.dek ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
            const pub = p.published_at ? new Date(p.published_at).toUTCString() : new Date().toUTCString();
            const cat = p.category?.name ?? "News";
            return `  <item>
    <title>${escapeXml(p.title)}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${pub}</pubDate>
    <category>${escapeXml(cat)}</category>
    <description>${desc}</description>
  </item>`;
          })
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>WKNA 49 News</title>
    <link>${origin}</link>
    <description>Charleston's local news, weather, and sports — from WKNA 49 News.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" },
        });
      },
    },
  },
});

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
