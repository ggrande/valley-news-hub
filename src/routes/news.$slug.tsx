import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Layout } from "@/components/site/Layout";
import { ArticleCard } from "@/components/site/ArticleCard";
import { ArticleImage } from "@/components/site/ArticleImage";
import { articles, formatDate, getArticle } from "@/lib/news-data";

export const Route = createFileRoute("/news/$slug")({
  loader: ({ params }) => {
    const article = getArticle(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData, params }) => {
    const a = loaderData?.article;
    return {
      meta: a
        ? [
            { title: `${a.title} — WKNA 49 News` },
            { name: "description", content: a.summary },
            { property: "og:title", content: a.title },
            { property: "og:description", content: a.summary },
            { property: "og:type", content: "article" },
            { property: "og:url", content: `/news/${params.slug}` },
            { property: "article:published_time", content: a.date },
            { property: "article:author", content: a.author },
            { property: "article:section", content: a.category },
          ]
        : [{ title: "Article — WKNA 49 News" }],
      links: [{ rel: "canonical", href: `/news/${params.slug}` }],
      scripts: a
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "NewsArticle",
                headline: a.title,
                datePublished: a.date,
                author: { "@type": "Person", name: a.author },
                articleSection: a.category,
                publisher: { "@type": "Organization", name: "WKNA 49 News" },
                description: a.summary,
              }),
            },
          ]
        : [],
    };
  },
  notFoundComponent: () => (
    <Layout>
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-primary">Article not found</h1>
        <p className="mt-2 text-muted-foreground">
          Older articles aren't part of the current WKNA49.com archive following our 2026 platform migration.
        </p>
        <Link to="/news" className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Latest news
        </Link>
      </div>
    </Layout>
  ),
  component: ArticlePage,
});

function ArticlePage() {
  const { article: a } = Route.useLoaderData();
  const related = articles.filter((x) => x.slug !== a.slug).slice(0, 3);

  return (
    <Layout>
      <article>
        <div className="border-b bg-[color:var(--ivory)]">
          <div className="mx-auto max-w-3xl px-4 py-10">
            <Link to="/news" className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--breaking)] hover:underline">
              {a.category}
            </Link>
            <h1 className="mt-3 font-display text-3xl font-black leading-tight tracking-tight text-primary sm:text-5xl">
              {a.title}
            </h1>
            <p className="mt-4 font-news text-xl text-muted-foreground">{a.summary}</p>
            <p className="mt-5 text-sm text-muted-foreground">
              By <span className="font-semibold text-primary">{a.author}</span> • {formatDate(a.date)} • WKNA 49 News
            </p>
          </div>
        </div>
        <ArticleImage hue={a.imageHue} label={a.title} className="mx-auto mt-8 aspect-[16/8] max-w-5xl rounded-lg" />
        <div className="mx-auto max-w-2xl px-4 py-10 font-news text-lg leading-relaxed text-foreground">
          {a.body.map((p, i) => (
            <p key={i} className="mb-5">{p}</p>
          ))}
          <p className="mt-8 border-t pt-5 text-sm italic text-muted-foreground">
            Have a news tip? <Link to="/submit-news-tip" className="text-[color:var(--broadcast)] underline">Send it to the WKNA 49 newsroom.</Link>
          </p>
        </div>
      </article>
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <h2 className="mb-5 border-b-2 border-primary pb-2 font-display text-2xl font-black text-primary">Related stories</h2>
        <div className="news-grid">
          {related.map((r) => <ArticleCard key={r.slug} a={r} />)}
        </div>
      </section>
    </Layout>
  );
}
