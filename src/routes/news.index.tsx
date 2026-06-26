import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/site/Layout";
import { ArticleCard } from "@/components/site/ArticleCard";
import { dbPostToArticle, fetchPublishedPosts } from "@/lib/posts-queries";

export const Route = createFileRoute("/news/")({
  loader: async () => {
    const posts = await fetchPublishedPosts({ limit: 20 });
    return { posts };
  },
  head: ({ loaderData }) => {
    const posts = loaderData?.posts ?? [];
    return {
      meta: [
        { title: "Local News — WKNA 49 News" },
        { name: "description", content: "Latest local news from Charleston, WV and the Kanawha Valley, from the WKNA 49 News team." },
        { property: "og:title", content: "Local News — WKNA 49 News" },
        { property: "og:description", content: "Latest local news from Charleston and the Kanawha Valley." },
        { property: "og:url", content: "https://wkna49.com/news" },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: "https://wkna49.com/news" }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              "@id": "https://wkna49.com/news#collection",
              url: "https://wkna49.com/news",
              name: "Local News — WKNA 49 News",
              isPartOf: { "@id": "https://wkna49.com/#website" },
              about: { "@id": "https://wkna49.com/#organization" },
            },
            {
              "@type": "ItemList",
              itemListOrder: "https://schema.org/ItemListOrderDescending",
              numberOfItems: posts.length,
              itemListElement: posts.map((p: any, i: number) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `https://wkna49.com/news/${p.slug}`,
                name: p.title,
              })),
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://wkna49.com/" },
                { "@type": "ListItem", position: 2, name: "News", item: "https://wkna49.com/news" },
              ],
            },
          ],
        }),
      }],
    };
  },
  component: NewsPage,
});

function NewsPage() {
  const q = useQuery({ queryKey: ["news-all"], queryFn: () => fetchPublishedPosts({ limit: 100 }) });
  const articles = (q.data ?? []).map(dbPostToArticle);
  return (
    <Layout>
      <PageHeader eyebrow="WKNA 49 Newsroom" title="News" description="Headlines from across the Kanawha Valley and West Virginia, reported by the WKNA 49 News team." />
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex flex-wrap gap-2">
          <Link to="/news" className="rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground">All</Link>
          <Link to="/news/local" className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-accent">Local</Link>
          {["Education", "Traffic", "Community", "Business", "Sports", "Weather"].map((c) => (
            <span key={c} className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c}</span>
          ))}
        </div>
        <div className="news-grid">
          {articles.map((a) => <ArticleCard key={a.slug} a={a} />)}
        </div>
      </section>
    </Layout>
  );
}
