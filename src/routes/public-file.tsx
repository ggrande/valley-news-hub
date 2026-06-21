import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";

export const Route = createFileRoute("/public-file")({
  head: () => ({
    meta: [
      { title: "Public File & EEO — WKNA-TV 49" },
      { name: "description", content: "WKNA-TV 49 public file and EEO information." },
      { property: "og:url", content: "/public-file" },
    ],
    links: [{ rel: "canonical", href: "/public-file" }],
  }),
  component: Page,
});

function Page() {
  return (
    <Layout>
      <PageHeader eyebrow="Station Information" title="Public File & EEO" />
      <article className="mx-auto max-w-3xl px-4 py-10 font-news text-lg leading-relaxed">
        <p>WKNA-TV 49 maintains a station public file and EEO Public File Report in accordance with applicable regulations. This page provides contact information for accessing those materials.</p>
        <h2 className="mt-8 font-display text-2xl font-bold text-primary">Public File contact</h2>
        <p className="mt-3">Requests related to the WKNA-TV 49 public file may be directed to <a className="text-[color:var(--broadcast)] underline" href="mailto:news@wkna49.com">news@wkna49.com</a>, attention: Public File Coordinator.</p>
        <h2 className="mt-8 font-display text-2xl font-bold text-primary">EEO Report</h2>
        <p className="mt-3">WKNA-TV 49 is an equal opportunity employer. The station's EEO Public File Report and information about employment outreach is available upon request through <a className="text-[color:var(--broadcast)] underline" href="mailto:careers@wkna49.com">careers@wkna49.com</a>.</p>
        <h2 className="mt-8 font-display text-2xl font-bold text-primary">Children's programming</h2>
        <p className="mt-3">Requests for information about children's programming reports may be submitted through the public file contact above.</p>
      </article>
    </Layout>
  );
}
