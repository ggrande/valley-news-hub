import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";

export const Route = createFileRoute("/terms-of-use")({
  head: () => ({
    meta: [
      { title: "Terms of Use — WKNA 49 News" },
      { name: "description", content: "Terms governing use of WKNA49.com." },
      { property: "og:url", content: "/terms-of-use" },
    ],
    links: [{ rel: "canonical", href: "/terms-of-use" }],
  }),
  component: Page,
});

function Page() {
  return (
    <Layout>
      <PageHeader eyebrow="Policies" title="Terms of Use" />
      <article className="mx-auto max-w-3xl px-4 py-10 font-news text-lg leading-relaxed">
        <p>By accessing WKNA49.com you agree to these terms. WKNA-TV 49 may update these terms from time to time.</p>
        <h2 className="mt-8 font-display text-2xl font-bold text-primary">Content</h2>
        <p className="mt-3">All content on WKNA49.com, including articles, video, graphics, and the WKNA 49 News branding, is owned by WKNA-TV 49 or its licensors. You may share links and short excerpts with attribution; please contact us before redistributing full articles or video.</p>
        <h2 className="mt-8 font-display text-2xl font-bold text-primary">Submissions</h2>
        <p className="mt-3">News tips, community submissions, and other materials you send to WKNA 49 may be used in our reporting. We will follow your stated source preferences whenever possible.</p>
        <h2 className="mt-8 font-display text-2xl font-bold text-primary">Disclaimer</h2>
        <p className="mt-3">WKNA49.com is provided on an "as is" basis. While we work hard to keep information accurate and current, we make no warranties regarding the completeness or timeliness of any content.</p>
      </article>
    </Layout>
  );
}
