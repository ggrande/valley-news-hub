import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://wkna49.com";
const PUBLISHER = "WKNA 49 News";
const PUBLISHER_LOGO = "https://wkna49.com/logo.png";

// Google Web Stories (AMP). Served as raw AMP HTML at /web-stories/:slug
// Spec: https://developers.google.com/search/docs/appearance/web-stories
export const Route = createFileRoute("/api/public/web-stories/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: post } = await supabase
          .from("posts")
          .select("slug, title, dek, body, published_at, updated_at, featured_image, seo_description, author:authors(name), category:categories(name)")
          .eq("slug", params.slug)
          .eq("status", "published")
          .maybeSingle();

        if (!post) {
          return new Response("Not found", { status: 404 });
        }

        const p = post as any;
        const title = p.title as string;
        const summary = (p.seo_description ?? p.dek ?? "") as string;
        const image = (p.featured_image as string) || "https://wkna49.com/logo.png";
        const author = p.author?.name ?? "WKNA 49 Newsroom";
        const published = p.published_at ?? new Date().toISOString();
        const modified = p.updated_at ?? published;
        const canonical = `${BASE_URL}/news/${p.slug}`;
        const storyUrl = `${BASE_URL}/api/public/web-stories/${p.slug}`;

        // Split body into up to 4 short pages
        const paragraphs = String(p.body ?? "")
          .split(/\n\n+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 4);

        const ldJson = {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          mainEntityOfPage: { "@type": "WebPage", "@id": storyUrl },
          headline: title.slice(0, 110),
          description: summary,
          image: [image],
          datePublished: published,
          dateModified: modified,
          author: [{ "@type": "Person", name: author }],
          publisher: {
            "@type": "NewsMediaOrganization",
            name: PUBLISHER,
            logo: { "@type": "ImageObject", url: PUBLISHER_LOGO, width: 1024, height: 1024 },
          },
        };

        const coverPage = `
  <amp-story-page id="cover">
    <amp-story-grid-layer template="fill">
      <amp-img src="${esc(image)}" width="720" height="1280" layout="responsive" alt="${esc(title)}"></amp-img>
    </amp-story-grid-layer>
    <amp-story-grid-layer template="vertical" style="background:linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75) 100%);">
      <div style="flex:1"></div>
      <div style="padding:24px;color:#fff;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
        <p style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;margin:0 0 8px;color:#FFD66B;">${esc(p.category?.name ?? "News")}</p>
        <h1 style="font-size:30px;line-height:1.15;font-weight:900;margin:0;">${esc(title)}</h1>
        <p style="margin-top:12px;font-size:14px;opacity:.9;">By ${esc(author)} · WKNA 49 News</p>
      </div>
    </amp-story-grid-layer>
  </amp-story-page>`;

        const bodyPages = paragraphs.map((para, i) => `
  <amp-story-page id="p${i + 1}">
    <amp-story-grid-layer template="fill">
      <amp-img src="${esc(image)}" width="720" height="1280" layout="responsive" alt=""></amp-img>
    </amp-story-grid-layer>
    <amp-story-grid-layer template="vertical" style="background:linear-gradient(180deg, rgba(16,26,58,0.85) 0%, rgba(16,26,58,0.9) 100%);">
      <div style="padding:32px;color:#fff;font-family:Georgia,serif;font-size:22px;line-height:1.45;">${esc(para.slice(0, 380))}</div>
    </amp-story-grid-layer>
  </amp-story-page>`).join("\n");

        const ctaPage = `
  <amp-story-page id="cta">
    <amp-story-grid-layer template="fill">
      <amp-img src="${esc(image)}" width="720" height="1280" layout="responsive" alt=""></amp-img>
    </amp-story-grid-layer>
    <amp-story-grid-layer template="vertical" style="background:rgba(16,26,58,0.85);">
      <div style="flex:1"></div>
      <div style="padding:32px;color:#fff;font-family:-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;">
        <h2 style="font-size:26px;font-weight:900;margin:0 0 8px;">Read the full story</h2>
        <p style="opacity:.9;margin:0 0 16px;">on WKNA49.com</p>
      </div>
    </amp-story-grid-layer>
    <amp-story-page-attachment layout="nodisplay" href="${esc(canonical)}" theme="dark" cta-text="Read the full story">
    </amp-story-page-attachment>
  </amp-story-page>`;

        // Raw AMP HTML response for Google Web Stories.
        // No XML declaration, no namespace attribute, no XHTML content type.
        const html = `<!doctype html>
<html amp lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${esc(title)} — WKNA 49 News</title>
  <link rel="canonical" href="${esc(canonical)}"/>
  <meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1"/>
  <meta name="description" content="${esc(summary)}"/>
  <script async="async" src="https://cdn.ampproject.org/v0.js"></script>
  <script async="async" custom-element="amp-story" src="https://cdn.ampproject.org/v0/amp-story-1.0.js"></script>
  <script type="application/ld+json">${JSON.stringify(ldJson)}</script>
  <style amp-boilerplate="amp-boilerplate">body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate="amp-boilerplate">body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>
</head>
<body>
<amp-story standalone="standalone"
  title="${esc(title)}"
  publisher="${esc(PUBLISHER)}"
  publisher-logo-src="${esc(PUBLISHER_LOGO)}"
  poster-portrait-src="${esc(image)}">
${coverPage}
${bodyPages}
${ctaPage}
</amp-story>
</body>
</html>`;

        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
