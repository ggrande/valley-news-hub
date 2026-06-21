import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";

export const Route = createFileRoute("/accessibility")({
  head: () => ({
    meta: [
      { title: "Accessibility — WKNA 49 News" },
      { name: "description", content: "WKNA-TV 49's commitment to accessibility on WKNA49.com and on-air." },
      { property: "og:url", content: "/accessibility" },
    ],
    links: [{ rel: "canonical", href: "/accessibility" }],
  }),
  component: Page,
});

function Page() {
  return (
    <Layout>
      <PageHeader eyebrow="For All Viewers" title="Accessibility" />
      <article className="mx-auto max-w-3xl px-4 py-10 font-news text-lg leading-relaxed">
        <p>WKNA-TV 49 is committed to making WKNA49.com and our on-air programming accessible to people of all abilities. We design with semantic HTML, keyboard navigation, sufficient color contrast, and descriptive alternative text for images.</p>
        <h2 className="mt-8 font-display text-2xl font-bold text-primary">Closed Captioning</h2>
        <p className="mt-3">WKNA-TV 49 provides closed captioning on our newscasts. If you experience a captioning issue, please contact us using the information below so we can address it promptly.</p>
        <h2 className="mt-8 font-display text-2xl font-bold text-primary">Reporting accessibility issues</h2>
        <p className="mt-3">If you encounter an accessibility barrier on WKNA49.com or on-air, contact <a className="text-[color:var(--broadcast)] underline" href="mailto:news@wkna49.com">news@wkna49.com</a> or call 304-555-0149. Please include the page URL or program details so we can investigate.</p>
      </article>
    </Layout>
  );
}
