import { createFileRoute, notFound } from "@tanstack/react-router";
import { Layout } from "@/components/site/Layout";
import { TenantNav, TenantHeader } from "@/components/site/TenantNav";
import { MarkdownBody } from "@/components/site/MarkdownBody";
import { useTenantSite } from "@/lib/use-tenant-site";
import { getTenantLegalPage } from "@/lib/tenant-legal.functions";

export const Route = createFileRoute("/network_/$siteSlug/dmca")({
  loader: async ({ params }) => {
    const page = await getTenantLegalPage({ data: { slug: params.siteSlug, kind: "dmca" } });
    if (!page) throw notFound();
    return { page };
  },
  head: ({ params, loaderData }) => {
    const url = `https://network.wkna49.com/network/${params.siteSlug}/dmca`;
    const name = loaderData?.page?.siteName ?? params.siteSlug;
    return {
      meta: [
        { title: `DMCA / Copyright — ${name}` },
        { name: "description", content: `How to submit a DMCA copyright notice to ${name}.` },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: TenantDmca,
});

function TenantDmca() {
  const tenant = useTenantSite();
  const { page } = Route.useLoaderData();
  return (
    <Layout>
      <TenantNav tenant={tenant} active="legal" />
      <TenantHeader tenant={tenant} title={page.title} description={`Copyright notices for ${page.siteName}.`} />
      <article className="mx-auto max-w-3xl px-4 py-10 font-news text-base leading-relaxed text-foreground">
        <MarkdownBody source={page.body} />
      </article>
    </Layout>
  );
}
