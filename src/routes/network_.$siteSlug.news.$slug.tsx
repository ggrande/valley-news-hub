import { createFileRoute, notFound } from "@tanstack/react-router";
import { Layout } from "@/components/site/Layout";
import { ArticleImage } from "@/components/site/ArticleImage";
import { MarkdownBody } from "@/components/site/MarkdownBody";
import { fetchPostBySlug, dbPostToArticle } from "@/lib/posts-queries";
import { formatDate } from "@/lib/news-data";
import { createServerFn } from "@tanstack/react-start";

// Server fn: check that the master post exists, isn't hidden for this tenant.
const loadTenantPost = createServerFn({ method: "GET" })
  .inputValidator((d: { siteSlug: string; slug: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: site } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select("id, network_sync_enabled")
      .eq("subdomain", data.siteSlug)
      .maybeSingle();
    if (!site) return { notFound: true as const };

    const post = await fetchPostBySlug(data.slug);
    if (!post) return { notFound: true as const };

    if (site.network_sync_enabled === false) return { notFound: true as const };

    const { data: hide } = await (supabaseAdmin as any)
      .from("tenant_hidden_network_posts")
      .select("post_id")
      .eq("site_id", site.id)
      .eq("post_id", (post as any).id)
      .maybeSingle();
    if (hide) return { notFound: true as const };

    return { notFound: false as const, post };
  });

export const Route = createFileRoute("/network_/$siteSlug/news/$slug")({
  loader: async ({ params }) => {
    const r = await loadTenantPost({ data: { siteSlug: params.siteSlug, slug: params.slug } });
    if (r.notFound) throw notFound();
    return { post: r.post };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.post as any;
    if (!p) return {};
    const a = dbPostToArticle(p);
    return {
      meta: [
        { title: p.seo_title ?? `${a.title}` },
        { name: "description", content: p.seo_description ?? a.summary },
        { property: "og:title", content: a.title },
        { property: "og:description", content: p.seo_description ?? a.summary },
      ],
    };
  },
  component: TenantArticle,
});

function TenantArticle() {
  const { post } = Route.useLoaderData() as any;
  const a = dbPostToArticle(post);
  return (
    <Layout>
      <article className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--broadcast)]">
          {a.category} · From the WKNA 49 Network
        </p>
        <h1 className="mt-2 font-display text-4xl font-black leading-tight text-primary sm:text-5xl">
          {a.title}
        </h1>
        {a.summary && <p className="mt-3 text-lg text-muted-foreground">{a.summary}</p>}
        <p className="mt-4 text-xs text-muted-foreground">
          By {a.author} · {formatDate(a.date)}
        </p>
        {post.featured_image && (
          <div className="mt-6">
            <ArticleImage src={post.featured_image} alt={a.title} hue={a.imageHue} />
            {post.hero_caption && <p className="mt-2 text-xs text-muted-foreground">{post.hero_caption}</p>}
          </div>
        )}
        <div className="prose prose-neutral mt-6 max-w-none">
          <MarkdownBody source={post.body ?? ""} />
        </div>
      </article>
    </Layout>
  );
}
