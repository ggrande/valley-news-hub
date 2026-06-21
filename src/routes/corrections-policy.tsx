import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";

export const Route = createFileRoute("/corrections-policy")({
  head: () => ({
    meta: [
      { title: "Corrections Policy — WKNA 49 News" },
      { name: "description", content: "How WKNA 49 News handles corrections, clarifications, and updates to published reporting." },
      { property: "og:url", content: "/corrections-policy" },
    ],
    links: [{ rel: "canonical", href: "/corrections-policy" }],
  }),
  component: Page,
});

function Page() {
  return (
    <Layout>
      <PageHeader eyebrow="Editorial Standards" title="Corrections Policy" />
      <article className="prose prose-slate mx-auto max-w-3xl px-4 py-10 font-news text-lg leading-relaxed text-foreground">
        <p>WKNA 49 News is committed to accuracy. When we publish a factual error, we correct it promptly and transparently.</p>
        <h2 className="mt-8 font-display text-2xl font-bold text-primary">Reporting an error</h2>
        <p className="mt-3">If you believe you have spotted a factual error in our reporting on WKNA49.com or on-air, please contact our newsroom at <a className="text-[color:var(--broadcast)] underline" href="mailto:news@wkna49.com">news@wkna49.com</a> with the headline, publication date, and a description of the issue.</p>
        <h2 className="mt-8 font-display text-2xl font-bold text-primary">How we correct</h2>
        <p className="mt-3">Verified factual errors are corrected directly in the article. Significant corrections include a dated editor's note. Minor typographical fixes are made silently. We do not unpublish articles to address mistakes — we correct them.</p>
        <h2 className="mt-8 font-display text-2xl font-bold text-primary">Clarifications</h2>
        <p className="mt-3">Where wording could reasonably be misunderstood, we add a clarification rather than a correction. Clarifications are also noted at the bottom of the article.</p>
      </article>
    </Layout>
  );
}
