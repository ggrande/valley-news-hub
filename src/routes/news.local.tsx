import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";
import { ArticleCard } from "@/components/site/ArticleCard";
import { articles } from "@/lib/news-data";

export const Route = createFileRoute("/news/local")({
  head: () => ({
    meta: [
      { title: "Local News — Kanawha Valley | WKNA 49 News" },
      { name: "description", content: "Local stories from Charleston, WV and the surrounding Kanawha Valley communities." },
      { property: "og:url", content: "/news/local" },
    ],
    links: [{ rel: "canonical", href: "/news/local" }],
  }),
  component: LocalNews,
});

function LocalNews() {
  const local = articles.filter((a) => ["Local", "Community", "Traffic", "Education", "Business"].includes(a.category));
  return (
    <Layout>
      <PageHeader eyebrow="WKNA 49 News" title="Local News" description="Reporting from neighborhoods across Charleston and the Kanawha Valley." />
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="news-grid">
          {local.map((a) => <ArticleCard key={a.slug} a={a} />)}
        </div>
      </section>
    </Layout>
  );
}
