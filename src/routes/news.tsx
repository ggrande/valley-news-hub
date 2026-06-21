import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";
import { ArticleCard } from "@/components/site/ArticleCard";
import { articles } from "@/lib/news-data";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Local News — WKNA 49 News" },
      { name: "description", content: "Latest local news from Charleston, WV and the Kanawha Valley, from the WKNA 49 News team." },
      { property: "og:title", content: "Local News — WKNA 49 News" },
      { property: "og:description", content: "Latest local news from Charleston and the Kanawha Valley." },
      { property: "og:url", content: "/news" },
    ],
    links: [{ rel: "canonical", href: "/news" }],
  }),
  component: NewsPage,
});

function NewsPage() {
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
