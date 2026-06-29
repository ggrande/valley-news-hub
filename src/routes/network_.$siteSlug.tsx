import { createFileRoute, Outlet, notFound } from "@tanstack/react-router";
import { getTenantBySlug } from "@/lib/network-feed.functions";

export const Route = createFileRoute("/network_/$siteSlug")({
  loader: async ({ params }) => {
    const tenant = await getTenantBySlug({ data: { slug: params.siteSlug } });
    if (!tenant) throw notFound();
    return { tenant };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.tenant;
    if (!t) return {};
    return {
      meta: [
        { title: `${t.displayName} — Affiliate Station of WKNA 49` },
        { name: "robots", content: "index,follow" },
        { property: "og:site_name", content: t.displayName },
      ],
    };
  },
  component: () => <Outlet />,
});
