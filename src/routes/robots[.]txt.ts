import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// Host-aware robots.txt. The master WKNA 49 site hides /network from
// crawlers (that's the tenant admin plumbing at path /network/{slug}),
// while affiliate tenant hosts (custom domains + *.wkna49.com subdomains)
// serve a clean allow-all robots pointing at the per-tenant sitemap.

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

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const host = normalizeHost(request.headers.get("host")) ?? "wkna49.com";
        const scheme = request.headers.get("x-forwarded-proto") ?? "https";
        const body = isMasterHost(host)
          ? [
              "User-agent: *",
              "Allow: /",
              "Disallow: /network",
              "",
              "# Allow Google News and AI crawlers explicitly",
              "User-agent: Googlebot-News",
              "Allow: /",
              "",
              "User-agent: Googlebot",
              "Allow: /",
              "",
              "Sitemap: https://wkna49.com/sitemap.xml",
              "Sitemap: https://wkna49.com/news-sitemap.xml",
              "",
            ].join("\n")
          : [
              "User-agent: *",
              "Allow: /",
              "",
              `Sitemap: ${scheme}://${host}/sitemap.xml`,
              "",
            ].join("\n");
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
