import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Layout, PageHeader } from "@/components/site/Layout";
import { ArticleCard } from "@/components/site/ArticleCard";
import { getTenantFeed, type FeedItem } from "@/lib/network-feed.functions";
import type { Article } from "@/lib/news-data";

export const Route = createFileRoute("/network_/$siteSlug/news/")({
  component: TenantNewsIndex,
});

function hueFor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function toArticle(i: FeedItem): Article {
  return {
    slug: i.slug,
    title: i.title,
    category: i.category?.name ?? "News",
    author: i.author?.name ?? "WKNA 49 Newsroom",
    date: (i.published_at ?? new Date().toISOString()).slice(0, 10),
    summary: i.dek ?? "",
    body: [],
    imageHue: hueFor(i.slug),
    image: i.featured_image,
  };
}

function TenantNewsIndex() {
  const { siteSlug } = Route.useParams();
  const feedFn = useServerFn(getTenantFeed);
  const q = useQuery({
    queryKey: ["tenant-feed-news", siteSlug],
    queryFn: () => feedFn({ data: { siteSlug, limit: 60 } }),
  });
  return (
    <Layout>
      <PageHeader eyebrow="All stories" title="News" description="The latest from our newsroom and the WKNA 49 network." />
      <section className="mx-auto max-w-7xl px-4 py-8">
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        <div className="news-grid">
          {(q.data?.items ?? []).map((i) => (
            <Link key={i.id} to="/network_/$siteSlug/news/$slug" params={{ siteSlug, slug: i.slug }} className="block">
              <ArticleCard a={toArticle(i)} />
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
