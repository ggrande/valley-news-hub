import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";

export const Route = createFileRoute("/careers")({
  head: () => ({
    meta: [
      { title: "Careers — WKNA 49 News" },
      { name: "description", content: "Join the WKNA 49 News team. Open roles in our Charleston, West Virginia newsroom." },
      { property: "og:url", content: "/careers" },
    ],
    links: [{ rel: "canonical", href: "/careers" }],
  }),
  component: Careers,
});

const openings = [
  { title: "Multi-Skilled Journalist", dept: "Newsroom", type: "Full-time" },
  { title: "Morning Producer — WKNA 49 Morning Report", dept: "Newsroom", type: "Full-time" },
  { title: "Meteorologist", dept: "Weather", type: "Full-time" },
  { title: "Digital Content Producer", dept: "Digital", type: "Full-time" },
  { title: "Account Executive", dept: "Sales", type: "Full-time" },
  { title: "Newsroom Intern", dept: "Newsroom", type: "Internship" },
];

function Careers() {
  return (
    <Layout>
      <PageHeader eyebrow="Join Our Team" title="Careers at WKNA-TV 49" description="WKNA 49 News is hiring across the newsroom, weather, digital, and sales teams in Charleston." />
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="space-y-3">
          {openings.map((o) => (
            <article key={o.title} className="flex flex-col gap-2 rounded-lg border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-primary">{o.title}</h2>
                <p className="text-xs text-muted-foreground">{o.dept} • {o.type} • Charleston, WV</p>
              </div>
              <a
                href="mailto:careers@wkna49.com?subject=Application"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Apply
              </a>
            </article>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          To apply, send a résumé, cover letter, and reel or portfolio (where applicable) to{" "}
          <a className="text-[color:var(--broadcast)] underline" href="mailto:careers@wkna49.com">careers@wkna49.com</a>. WKNA-TV 49 is an equal opportunity employer.
        </p>
      </section>
    </Layout>
  );
}
