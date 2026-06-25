import type { ReactNode } from "react";
import { Layout, PageHeader } from "@/components/site/Layout";
import { MarkdownBody } from "@/components/site/MarkdownBody";
import { useSiteContent } from "@/lib/use-site-content";

type CmsPage = { title: string; meta_description?: string; body_md?: string };

/**
 * Renders a policy/about-style page where the title and body can be overridden
 * via the `site_content` CMS. Falls back to the provided defaults / children
 * when the CMS body is empty.
 */
export function CmsPage({
  contentKey,
  eyebrow,
  defaultTitle,
  description,
  children,
}: {
  contentKey: string;
  eyebrow?: string;
  defaultTitle: string;
  description?: string;
  children: ReactNode;
}) {
  const page = useSiteContent<CmsPage>(contentKey, { title: defaultTitle });
  const title = page.title || defaultTitle;
  const body = page.body_md?.trim();

  return (
    <Layout>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <article className="mx-auto max-w-3xl px-4 py-10 font-news text-lg leading-relaxed text-foreground">
        {body ? <MarkdownBody source={body} /> : children}
      </article>
    </Layout>
  );
}
