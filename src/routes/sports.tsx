import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";
import { ArticleCard } from "@/components/site/ArticleCard";
import { articles } from "@/lib/news-data";

export const Route = createFileRoute("/sports")({
  head: () => ({
    meta: [
      { title: "49 Sports — Kanawha Valley High School & Local Sports | WKNA 49" },
      { name: "description", content: "Scores, highlights, and local sports coverage from across the Kanawha Valley with WKNA 49 Sports." },
      { property: "og:url", content: "/sports" },
    ],
    links: [{ rel: "canonical", href: "/sports" }],
  }),
  component: SportsPage,
});

const scores = [
  { home: "Capital", away: "George Washington", hs: 6, as: 3, sport: "Baseball" },
  { home: "Saint Albans", away: "Nitro", hs: 4, as: 2, sport: "Softball" },
  { home: "South Charleston", away: "Riverside", hs: 7, as: 5, sport: "Baseball" },
  { home: "Charleston Catholic", away: "Sissonville", hs: 11, as: 9, sport: "Lacrosse" },
];

function SportsPage() {
  const sports = articles.filter((a) => a.category === "Sports" || a.category === "Community");
  return (
    <Layout>
      <PageHeader eyebrow="WKNA 49 Sports" title="49 Sports" description="High school highlights, local teams, and the Friday night scoreboard from across the Kanawha Valley." />
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="news-grid">
            {sports.map((a) => <ArticleCard key={a.slug} a={a} />)}
          </div>
          <aside>
            <h2 className="mb-3 border-b-2 border-primary pb-2 font-display text-xl font-black text-primary">Scoreboard</h2>
            <div className="rounded-lg border bg-card">
              {scores.map((s, i) => (
                <div key={i} className="border-b p-3 last:border-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--broadcast)]">{s.sport}</p>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span>{s.away}</span><span className="font-bold">{s.as}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{s.home}</span><span className="font-bold">{s.hs}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Catch <em>49 Sports Final</em> Friday nights during high school sports season.
            </p>
          </aside>
        </div>
      </section>
    </Layout>
  );
}
