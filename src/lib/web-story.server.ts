// Server-only helpers for generating + publishing AMP Web Stories to
// GitHub Pages. Supabase Storage cannot host AMP (forces text/plain,
// injects `x-robots-tag: none`, and wraps every object in a
// `default-src 'none'; sandbox` CSP). GitHub Pages serves plain
// text/html with no robots header — the only viable static host we
// already have credentials for.
//
// Files are committed to `docs/web-stories/{slug}/index.html` on the
// default branch via the GitHub Contents API. Pages serves from
// `/docs` on main. URL: https://{owner}.github.io/{repo}/web-stories/{slug}/

const BASE_URL = "https://wkna49.com";
const PUBLISHER = "WKNA 49 News";
const PUBLISHER_LOGO = "https://wkna49.com/logo.png";

export type WebStoryPost = {
  slug: string;
  title: string;
  dek?: string | null;
  body?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  featured_image?: string | null;
  seo_description?: string | null;
  author?: { name?: string | null } | null;
  category?: { name?: string | null } | null;
};

function esc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderWebStoryHtml(p: WebStoryPost): string {
  const title = p.title;
  const summary = (p.seo_description ?? p.dek ?? "") as string;
  const image = (p.featured_image as string) || "https://wkna49.com/logo.png";
  const author = p.author?.name ?? "WKNA 49 Newsroom";
  const published = p.published_at ?? new Date().toISOString();
  const modified = p.updated_at ?? published;
  const canonical = `${BASE_URL}/news/${p.slug}`;
  const storyUrl = publicStoryUrl(p.slug);

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

  return `<!doctype html>
<html amp="amp" lang="en">
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
}

function ghRepo(): { owner: string; repo: string } | null {
  const r = process.env.GITHUB_REPO;
  if (!r || !r.includes("/")) return null;
  const [owner, repo] = r.split("/");
  return { owner, repo };
}

export function publicStoryUrl(slug: string): string {
  const r = ghRepo();
  if (!r) return `${BASE_URL}/api/public/web-stories/${slug}`;
  // GitHub Pages serves docs/web-stories/{slug}/index.html at this URL.
  return `https://${r.owner}.github.io/${r.repo}/web-stories/${slug}/`;
}

async function gh(path: string, init: RequestInit = {}) {
  const pat = process.env.GH_DISPATCH_PAT!;
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "wkna49-web-stories",
      ...(init.headers || {}),
    },
  });
}

let pagesEnsured = false;
async function ensurePagesEnabled(owner: string, repo: string) {
  if (pagesEnsured) return;
  // Idempotent: GET first, then POST if missing. 409 on POST = already exists.
  const got = await gh(`/repos/${owner}/${repo}/pages`);
  if (got.status === 200) {
    pagesEnsured = true;
    return;
  }
  const res = await gh(`/repos/${owner}/${repo}/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: { branch: "main", path: "/docs" },
    }),
  });
  if (res.status === 201 || res.status === 409) {
    pagesEnsured = true;
    return;
  }
  const txt = await res.text().catch(() => "");
  console.warn("[web-stories] ensurePagesEnabled non-fatal:", res.status, txt.slice(0, 200));
  // Don't throw — committing the file still works; Pages may be set up later.
}

function b64(s: string): string {
  // edge-safe base64 of UTF-8 string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const B: any = (globalThis as any).Buffer;
  if (B) return B.from(s, "utf-8").toString("base64");
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function ensureWebStoryUploaded(post: WebStoryPost): Promise<string> {
  const r = ghRepo();
  if (!r) throw new Error("GITHUB_REPO not configured");
  if (!process.env.GH_DISPATCH_PAT) throw new Error("GH_DISPATCH_PAT not configured");

  const html = renderWebStoryHtml(post);
  const path = `docs/web-stories/${post.slug}/index.html`;
  const url = publicStoryUrl(post.slug);

  await ensurePagesEnabled(r.owner, r.repo);

  // GET current SHA if file exists (Contents API requires sha for updates).
  let sha: string | undefined;
  const getRes = await gh(`/repos/${r.owner}/${r.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`);
  if (getRes.status === 200) {
    const j: any = await getRes.json();
    sha = j?.sha;
    // Skip rewrite if content is byte-identical (avoid noisy commits on every sitemap hit).
    try {
      const existingB64 = String(j?.content ?? "").replace(/\n/g, "");
      if (existingB64 && existingB64 === b64(html)) {
        return url;
      }
    } catch {
      /* fall through to write */
    }
  }

  const putRes = await gh(
    `/repos/${r.owner}/${r.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `web-story: publish ${post.slug}`,
        content: b64(html),
        sha,
        committer: { name: "WKNA Web Stories Bot", email: "bot@wkna49.com" },
      }),
    },
  );
  if (!putRes.ok) {
    const txt = await putRes.text().catch(() => "");
    throw new Error(`GitHub commit failed ${putRes.status}: ${txt.slice(0, 300)}`);
  }
  return url;
}
