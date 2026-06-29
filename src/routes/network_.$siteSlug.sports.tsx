import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Layout } from "@/components/site/Layout";
import { TenantNav, TenantHeader } from "@/components/site/TenantNav";
import { ArticleCard } from "@/components/site/ArticleCard";
import { getTenantFeed, type FeedItem } from "@/lib/network-feed.functions";
import { useTenantSite } from "@/lib/use-tenant-site";
import type { Article } from "@/lib/news-data";

export const Route = createFileRoute("/network_/$siteSlug/sports")({
  component: TenantSports,
});

function hueFor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
function toArticle(i: FeedItem): Article {
  return {
    slug: i.slug, title: i.title,
    category: i.category?.name ?? "Sports",
    author: i.author?.name ?? "Newsroom",
    date: (i.published_at ?? new Date().toISOString()).slice(0, 10),
    summary: i.dek ?? "", body: [],
    imageHue: hueFor(i.slug), image: i.featured_image,
  };
}

function TenantSports() {
  const { siteSlug } = Route.useParams();
  const tenant = useTenantSite();
  const feedFn = useServerFn(getTenantFeed);
  const q = useQuery({
    queryKey: ["tenant-sports", siteSlug],
    queryFn: () => feedFn({ data: { siteSlug, limit: 60, categorySlug: "sports" } }),
  });
  const items = q.data?.items ?? [];
  return (
    <Layout>
      <TenantNav tenant={tenant} active="sports" />
      <TenantHeader tenant={tenant} title="Sports" description="High school, college, and pro coverage from the WKNA 49 network." />
      <section className="mx-auto max-w-7xl px-4 py-8">
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!q.isLoading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No sports stories yet — check back soon.</p>
        )}
        <div className="news-grid">
          {items.map((i) => (
            <Link key={i.id} to="/network_/$siteSlug/news/$slug" params={{ siteSlug, slug: i.slug }} className="block">
              <ArticleCard a={toArticle(i)} />
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
