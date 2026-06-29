import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Layout } from "../components/site/Layout";
import { NetworkUpdateBanner } from "../components/NetworkUpdateBanner";
import { useTenant } from "../lib/use-tenant";

function NotFoundComponent() {
  // On network.wkna49.com, rewrite bare `/{slug}/...` URLs to the actual
  // path-based tenant route `/network/{slug}/...` so shared links work
  // without forcing the `/network/` prefix in the URL bar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname.toLowerCase();
    if (host !== "network.wkna49.com") return;
    const path = window.location.pathname;
    if (!path || path === "/") return;
    if (path.startsWith("/network/") || path.startsWith("/network_/") || path.startsWith("/api/") || path.startsWith("/_") || path.startsWith("/station/")) return;
    const rest = path + window.location.search + window.location.hash;
    window.location.replace(`/network${rest}`);
  }, []);
  return (
    <Layout>
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--breaking)]">Error 404</p>
        <h1 className="mt-3 font-display text-5xl font-black text-primary">Page not found</h1>
        <p className="mt-3 text-muted-foreground">
          The page you're looking for isn't part of WKNA49.com. Try the homepage or our latest news.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Go home</Link>
          <Link to="/news" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold">Latest news</Link>
        </div>
      </div>
    </Layout>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <Layout>
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-primary">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try refreshing or head back home.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Try again</button>
          <a href="/" className="h-10 rounded-md border px-4 py-2 text-sm font-semibold">Go home</a>
        </div>
      </div>
    </Layout>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({

    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WKNA 49 News — Local News for the Kanawha Valley" },
      { name: "description", content: "WKNA-TV 49 — Charleston's Channel 49. Local news, weather, sports, and live coverage from the Kanawha Valley." },
      { name: "author", content: "WKNA-TV 49" },
      { name: "theme-color", content: "#101a3a" },
      { name: "google-site-verification", content: "PSEI_2pt6EH5BpztOnh3uzr-p8oFsur94EyiBq8rI88" },
      { property: "og:site_name", content: "WKNA 49 News" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "WKNA 49 News — Local News for the Kanawha Valley" },
      { name: "twitter:title", content: "WKNA 49 News — Local News for the Kanawha Valley" },
      { property: "og:description", content: "WKNA-TV 49 — Charleston's Channel 49. Local news, weather, sports, and live coverage from the Kanawha Valley." },
      { name: "twitter:description", content: "WKNA-TV 49 — Charleston's Channel 49. Local news, weather, sports, and live coverage from the Kanawha Valley." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/423ff38d-1525-4183-9e13-5cd353f92abb/id-preview-81d154c2--354111e0-8b0b-4250-b183-df5baf2db5bd.lovable.app-1782104617433.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/423ff38d-1525-4183-9e13-5cd353f92abb/id-preview-81d154c2--354111e0-8b0b-4250-b183-df5baf2db5bd.lovable.app-1782104617433.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800;900&family=Source+Serif+4:wght@400;600&display=swap" },
      { rel: "alternate", type: "application/rss+xml", title: "WKNA 49 News", href: "https://wkna49.com/rss.xml" },
      { rel: "icon", type: "image/png", href: "/logo-round.png" },
      { rel: "apple-touch-icon", href: "/logo-round.png" },
    ],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "NewsMediaOrganization",
            "@id": "https://wkna49.com/#organization",
            name: "WKNA 49 News",
            alternateName: "WKNA-TV 49",
            url: "https://wkna49.com",
            logo: { "@type": "ImageObject", url: "https://wkna49.com/logo.png", width: 1024, height: 1024 },
            image: "https://wkna49.com/logo.png",
            description: "Charleston's Channel 49 — local news, weather, sports and live coverage for the Kanawha Valley.",
            areaServed: { "@type": "AdministrativeArea", name: "Kanawha Valley, West Virginia" },
            address: { "@type": "PostalAddress", addressLocality: "Charleston", addressRegion: "WV", addressCountry: "US" },
            sameAs: ["https://www.reddit.com/user/WKNA49"],
          },
          {
            "@type": "WebSite",
            "@id": "https://wkna49.com/#website",
            url: "https://wkna49.com/",
            name: "WKNA 49 News",
            publisher: { "@id": "https://wkna49.com/#organization" },
            inLanguage: "en-US",
            potentialAction: {
              "@type": "SearchAction",
              target: { "@type": "EntryPoint", urlTemplate: "https://wkna49.com/news?q={search_term_string}" },
              "query-input": "required name=search_term_string",
            },
          },
        ],
      }),
    }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Client-only tenant subdomain redirect. SSR will render the master page once
  // and the client mount redirects to the station admin if needed.
  // Back-compat: old `{slug}.wkna49.com/*` URLs now redirect to the
  // path-based tenant route `network.wkna49.com/{slug}/*`. Custom domains are
  // untouched.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname.toLowerCase();
    if (!host.endsWith(".wkna49.com")) return;
    if (host === "www.wkna49.com" || host === "wkna49.com" || host === "network.wkna49.com") return;
    const slug = host.replace(/\.wkna49\.com$/, "");
    if (!slug || slug.includes(".")) return; // skip nested subdomains
    const rest = window.location.pathname + window.location.search + window.location.hash;
    window.location.replace(`https://network.wkna49.com/${slug}${rest === "/" ? "" : rest}`);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <TenantTitle />
      <NetworkUpdateBanner />
      <Outlet />
    </QueryClientProvider>
  );
}

// Lightweight tenant-aware <title> override so subdomains read as the
// affiliate's station name in the browser tab and on share previews crawled
// client-side. SSR still serves the master metadata for SEO of the root site.
function TenantTitle() {
  const { tenant } = useTenant();
  useEffect(() => {
    if (typeof document === "undefined" || !tenant) return;
    document.title = `${tenant.displayName} — Affiliate Station of WKNA 49`;
  }, [tenant]);
  return null;
}
