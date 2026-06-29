import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Layout } from "@/components/site/Layout";
import { ArticleCard } from "@/components/site/ArticleCard";
import { getTenantFeed, type FeedItem } from "@/lib/network-feed.functions";
import type { Article } from "@/lib/news-data";

export const Route = createFileRoute("/network_/$siteSlug/")({
  component: TenantHome,
});

function hueFor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function feedToArticle(item: FeedItem): Article & { _slugPrefix: string; _source: FeedItem["source"] } {
  return {
    slug: item.slug,
    title: item.title,
    category: item.category?.name ?? "News",
    author: item.author?.name ?? "WKNA 49 Newsroom",
    date: (item.published_at ?? new Date().toISOString()).slice(0, 10),
    summary: item.dek ?? "",
    body: [],
    imageHue: hueFor(item.slug),
    image: item.featured_image,
    _slugPrefix: "",
    _source: item.source,
  };
}

function TenantHome() {
  const { siteSlug } = Route.useParams();
  const { tenant } = Route.useRouteContext() as any;
  const router = useRouter();
  const parent = router.routesById["/network_/$siteSlug"];
  const tenantData = (parent?.useLoaderData?.() as any)?.tenant;

  const feedFn = useServerFn(getTenantFeed);
  const q = useQuery({
    queryKey: ["tenant-feed", siteSlug],
    queryFn: () => feedFn({ data: { siteSlug, limit: 30 } }),
  });

  const items = (q.data?.items ?? []).map(feedToArticle);
  const [hero, ...rest] = items;
  const t = tenantData ?? tenant;

  return (
    <Layout>
      <section className="border-b bg-[color:var(--ivory)]">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--broadcast)]">
            Affiliate Station of WKNA 49
          </p>
          <h1 className="mt-1 font-display text-3xl font-black text-primary sm:text-4xl">
            {t?.displayName ?? "Station"}
          </h1>
          {t?.tagline && <p className="mt-2 text-muted-foreground">{t.tagline}</p>}
        </div>
      </section>

      {q.isLoading && (
        <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-muted-foreground">Loading newsroom…</div>
      )}

      {hero && (
        <section className="mx-auto max-w-7xl px-4 py-8">
          <TenantArticleLink slug={hero.slug} siteSlug={siteSlug}>
            <ArticleCard a={hero} variant="hero" />
          </TenantArticleLink>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-5 flex items-end justify-between gap-3 border-b-2 border-primary pb-2">
          <h2 className="font-display text-2xl font-black tracking-tight text-primary sm:text-3xl">Latest</h2>
          <Link to="/network_/$siteSlug/news" params={{ siteSlug }} className="text-xs font-semibold uppercase tracking-wide text-[color:var(--broadcast)] hover:underline">
            More news
          </Link>
        </div>
        <div className="news-grid">
          {rest.slice(0, 9).map((a) => (
            <TenantArticleLink key={a.slug} slug={a.slug} siteSlug={siteSlug}>
              <ArticleCard a={a} />
            </TenantArticleLink>
          ))}
        </div>
      </section>
    </Layout>
  );
}

function TenantArticleLink({
  slug,
  siteSlug,
  children,
}: {
  slug: string;
  siteSlug: string;
  children: React.ReactNode;
}) {
  return (
    <Link to="/network_/$siteSlug/news/$slug" params={{ siteSlug, slug }} className="block">
      {children}
    </Link>
  );
}
