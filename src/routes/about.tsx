import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";
import { MarkdownBody } from "@/components/site/MarkdownBody";
import { useSiteContent } from "@/lib/use-site-content";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About WKNA-TV 49 — Charleston's Channel 49" },
      { name: "description", content: "About WKNA-TV 49 — station history, the WKNA49.com digital relaunch, and our mission to serve the Kanawha Valley." },
      { property: "og:title", content: "About WKNA-TV 49" },
      { property: "og:description", content: "Station history, the WKNA49.com digital relaunch, and our mission to deliver local news, weather, and sports for the Kanawha Valley." },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  const page = useSiteContent<{ title: string; body_md?: string }>("page_about", { title: "About WKNA-TV 49" });
  const override = page.body_md?.trim();
  return (
    <Layout>
      <PageHeader
        eyebrow="Our Station"
        title={page.title || "About WKNA-TV 49"}
        description="Charleston's Channel 49 — local news for the Kanawha Valley."
      />
      {override ? (
        <article className="mx-auto max-w-3xl px-4 py-12 font-news text-lg leading-relaxed text-foreground">
          <MarkdownBody source={override} />
        </article>
      ) : (
      <section className="mx-auto max-w-3xl px-4 py-12 font-news text-lg leading-relaxed text-foreground">
        <p>
          WKNA-TV 49 is a Charleston-based local news station serving the Kanawha Valley and surrounding communities. WKNA-TV first appeared on Channel 49 in Charleston in the early 1950s during the first wave of UHF television in West Virginia. The station began test-pattern operations on September 21, 1953, and regular broadcasts began on October 12, 1953. The original broadcast era ended in 1955, but the WKNA-TV name remained part of Charleston television history.
        </p>
        <p className="mt-5">
          WKNA49.com launched on January 18, 2001, as the station's first digital home. On April 10, 2025, WKNA-TV transferred ownership and began a modernization of its digital operations, newsroom systems, visual identity, and publishing platform. The redesigned WKNA49.com launched in early 2026 with a renewed focus on local news, weather, live coverage, and community service.
        </p>
        <p className="mt-5">
          Because the 2026 redesign moved WKNA-TV to a new publishing system, older web articles are not part of the current public article archive. Selected station history, photos, and notable broadcast materials may be added to the WKNA-TV history section over time.
        </p>

        <h2 className="mt-12 font-display text-2xl font-black text-primary">Timeline</h2>
        <ul className="mt-4 space-y-3 text-base">
          {[
            ["September 21, 1953", "WKNA-TV begins test-pattern operations on Channel 49 in Charleston."],
            ["October 12, 1953", "Regular broadcasts begin."],
            ["1955", "The original WKNA-TV broadcast era ends."],
            ["January 18, 2001", "WKNA49.com launches as the station's first digital home."],
            ["April 10, 2025", "WKNA-TV transfers ownership and begins modernization."],
            ["Early 2026", "The redesigned WKNA49.com launches with new newsroom systems."],
          ].map(([d, t]) => (
            <li key={d} className="grid gap-1 border-l-2 border-[color:var(--gold)] pl-4 sm:grid-cols-[180px_1fr] sm:gap-4">
              <p className="text-sm font-bold uppercase tracking-wider text-[color:var(--broadcast)]">{d}</p>
              <p className="text-base text-foreground">{t}</p>
            </li>
          ))}
        </ul>

        <h2 className="mt-12 font-display text-2xl font-black text-primary">Our Newsroom</h2>
        <p className="mt-3">
          The WKNA 49 newsroom is built around local reporting — neighborhood stories, weather that affects daily life in the valley, high school sports, and the institutions that make Charleston home.
        </p>
      </section>
      )}
    </Layout>
  );
}
