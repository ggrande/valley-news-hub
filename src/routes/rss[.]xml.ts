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
          .select("slug, title, dek, body, published_at, updated_at, seo_description, featured_image, og_image, author_name, category:categories(name)")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(50);

        const origin = new URL(request.url).origin;
        const selfUrl = `${origin}/rss.xml`;
        const items = (posts ?? [])
          .map((p: any) => {
            const link = `${origin}/news/${p.slug}`;
            const desc = p.seo_description ?? p.dek ?? "";
            const pub = p.published_at ? new Date(p.published_at).toUTCString() : new Date().toUTCString();
            const cat = p.category?.name ?? "News";
            const img = p.og_image ?? p.featured_image;
            const author = p.author_name ?? "WKNA 49 Newsroom";
            const mediaTag = img
              ? `\n    <media:content url="${escapeXml(img)}" medium="image" />\n    <enclosure url="${escapeXml(img)}" type="image/jpeg" length="0" />`
              : "";
            const contentHtml = p.body
              ? `<![CDATA[${img ? `<p><img src="${img}" alt="${escapeXml(p.title)}" /></p>` : ""}${p.body}]]>`
              : `<![CDATA[${escapeXml(desc)}]]>`;
            return `  <item>
    <title>${escapeXml(p.title)}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${pub}</pubDate>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <category>${escapeXml(cat)}</category>
    <description>${escapeXml(desc)}</description>
    <content:encoded>${contentHtml}</content:encoded>${mediaTag}
  </item>`;
          })
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>WKNA 49 News</title>
    <link>${origin}</link>
    <atom:link href="${selfUrl}" rel="self" type="application/rss+xml" />
    <description>Charleston's local news, weather, and sports — from WKNA 49 News.</description>
    <language>en-us</language>
    <copyright>© ${new Date().getFullYear()} WKNA 49 News</copyright>
    <image>
      <url>${origin}/logo.png</url>
      <title>WKNA 49 News</title>
      <link>${origin}</link>
    </image>
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
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
