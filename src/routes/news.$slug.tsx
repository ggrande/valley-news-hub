import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/site/Layout";
import { ArticleCard } from "@/components/site/ArticleCard";
import { ArticleImage } from "@/components/site/ArticleImage";
import { SupportButton } from "@/components/site/SupportButton";
import { ShareBar } from "@/components/site/ShareBar";
import { formatDate } from "@/lib/news-data";
import { ShoppingBag } from "lucide-react";
import { dbPostToArticle, fetchCommentsForPost, fetchPostBySlug, fetchPublishedPosts, fetchSetting } from "@/lib/posts-queries";

export const Route = createFileRoute("/news/$slug")({
  loader: async ({ params }) => {
    const post = await fetchPostBySlug(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.post;
    if (!p) return { meta: [{ title: "Article — WKNA 49 News" }] };
    const a = dbPostToArticle(p);
    const canonical = `https://wkna49.com/news/${params.slug}`;
    const image = p.og_image ?? p.featured_image ?? "https://wkna49.com/og-default.jpg";
    const published = p.published_at ?? a.date;
    const modified = p.updated_at ?? published;
    return {
      meta: [
        { title: p.seo_title ?? `${a.title} — WKNA 49 News` },
        { name: "description", content: p.seo_description ?? a.summary },
        { name: "news_keywords", content: a.category },
        { property: "og:title", content: a.title },
        { property: "og:description", content: p.seo_description ?? a.summary },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonical },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: a.title },
        { name: "twitter:description", content: p.seo_description ?? a.summary },
        { name: "twitter:image", content: image },
        { property: "article:published_time", content: published },
        { property: "article:modified_time", content: modified },
        { property: "article:author", content: a.author },
        { property: "article:section", content: a.category },
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "NewsArticle",
              "@id": `${canonical}#article`,
              mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
              headline: a.title.slice(0, 110),
              description: p.seo_description ?? a.summary,
              image: [image],
              datePublished: published,
              dateModified: modified,
              author: [{ "@type": "Person", name: a.author, url: "https://wkna49.com/about" }],
              articleSection: a.category,
              isAccessibleForFree: true,
              inLanguage: "en-US",
              publisher: { "@id": "https://wkna49.com/#organization" },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://wkna49.com/" },
                { "@type": "ListItem", position: 2, name: "News", item: "https://wkna49.com/news" },
                { "@type": "ListItem", position: 3, name: a.category, item: "https://wkna49.com/news" },
                { "@type": "ListItem", position: 4, name: a.title, item: canonical },
              ],
            },
            {
              "@type": "NewsMediaOrganization",
              "@id": "https://wkna49.com/#organization",
              name: "WKNA 49 News",
              alternateName: "WKNA-TV 49",
              url: "https://wkna49.com",
              logo: { "@type": "ImageObject", url: "https://wkna49.com/logo.png", width: 1024, height: 1024 },
            },
          ],
        }),
      }],
    };
  },
  notFoundComponent: () => (
    <Layout>
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-primary">Article not found</h1>
        <p className="mt-2 text-muted-foreground">Older articles aren't part of the current WKNA49.com archive following our 2026 platform migration.</p>
        <Link to="/news" className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Latest news</Link>
      </div>
    </Layout>
  ),
  component: ArticlePage,
});

function ArticlePage() {
  const { post } = Route.useLoaderData();
  const a = dbPostToArticle(post);

  const related = useQuery({ queryKey: ["related"], queryFn: () => fetchPublishedPosts({ limit: 4 }) });
  const showComments = useQuery({ queryKey: ["setting-show-comments"], queryFn: () => fetchSetting<boolean>("show_imported_discussion", true) });
  const comments = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => fetchCommentsForPost(post.id),
    enabled: !!showComments.data,
  });

  const relatedArticles = (related.data ?? []).filter((p) => p.slug !== post.slug).slice(0, 3).map(dbPostToArticle);

  return (
    <Layout>
      <article>
        <div className="border-b bg-[color:var(--ivory)]">
          <div className="mx-auto max-w-3xl px-4 py-10">
            <Link to="/news" className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--breaking)] hover:underline">{a.category}</Link>
            {post.is_breaking && <span className="ml-2 rounded bg-[color:var(--breaking)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">Breaking</span>}
            <h1 className="mt-3 font-display text-3xl font-black leading-tight tracking-tight text-primary sm:text-5xl">{a.title}</h1>
            <p className="mt-4 font-news text-xl text-muted-foreground">{a.summary}</p>
            <p className="mt-5 text-sm text-muted-foreground">
              By <span className="font-semibold text-primary">{a.author}</span> • {formatDate(a.date)} • WKNA 49 News
            </p>
            <ShareBar
              className="mt-5"
              url={`https://wkna49.com/news/${post.slug}`}
              title={a.title}
              summary={a.summary}
            />
          </div>
        </div>
        {post.featured_image ? (
          <img src={post.featured_image} alt={post.hero_caption ?? a.title} className="mx-auto mt-8 aspect-[16/8] max-w-5xl rounded-lg object-cover" />
        ) : (
          <ArticleImage hue={a.imageHue} label={a.title} className="mx-auto mt-8 aspect-[16/8] max-w-5xl rounded-lg" />
        )}
        <div className="mx-auto max-w-2xl px-4 py-10 font-news text-lg leading-relaxed text-foreground">
          {a.body.map((p: string, i: number) => <p key={i} className="mb-5">{p}</p>)}
          <aside className="mt-8 rounded-lg border bg-[color:var(--ivory)] p-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--breaking)]">Support local journalism</p>
            <h3 className="mt-1 font-display text-xl font-black text-primary">Like this story? Chip in.</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">WKNA 49 News is reader-supported. Buy us a coffee or send crypto to keep Kanawha Valley reporting going.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <SupportButton variant="inline" />
              <Link to="/merch" className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold text-primary hover:bg-accent">
                <ShoppingBag className="size-4" /> View Our Merch
              </Link>
            </div>
          </aside>
          <p className="mt-8 border-t pt-5 text-sm italic text-muted-foreground">
            Have a news tip? <Link to="/submit-news-tip" className="text-[color:var(--broadcast)] underline">Send it to the WKNA 49 newsroom.</Link>
          </p>
          <ShareBar
            className="mt-6 justify-center"
            url={`https://wkna49.com/news/${post.slug}`}
            title={a.title}
            summary={a.summary}
            label="Share"
          />
        </div>
      </article>

      {showComments.data && (comments.data?.length ?? 0) > 0 && (
        <section className="mx-auto max-w-3xl px-4 pb-12">
          <h2 className="mb-5 border-b-2 border-primary pb-2 font-display text-2xl font-black text-primary">Reader Discussion</h2>
          <ul className="space-y-4">
            {comments.data!.map((c: any) => (
              <li key={c.id} className="rounded-lg border bg-card p-4" style={{ marginLeft: Math.min(c.nesting_level ?? 0, 3) * 16 }}>
                <p className="text-xs">
                  <span className="font-semibold text-primary">{c.display_name}</span>
                  {c.is_featured && <span className="ml-2 rounded bg-[color:var(--gold)]/30 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[color:var(--navy-dark)]">Featured</span>}
                  {c.source_created_at && <span className="ml-2 text-muted-foreground">· {new Date(c.source_created_at).toLocaleDateString()}</span>}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{c.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-12">
        <h2 className="mb-5 border-b-2 border-primary pb-2 font-display text-2xl font-black text-primary">Related stories</h2>
        <div className="news-grid">
          {relatedArticles.map((r) => <ArticleCard key={r.slug} a={r} />)}
        </div>
      </section>
    </Layout>
  );
}
