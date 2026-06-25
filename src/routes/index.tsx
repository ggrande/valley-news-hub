import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/site/Layout";
import { ArticleCard } from "@/components/site/ArticleCard";
import { WeatherCard } from "@/components/site/WeatherCard";
import { LivePlayer } from "@/components/site/LivePlayer";
import { Newsletter } from "@/components/site/Newsletter";
import { SupportButton } from "@/components/site/SupportButton";
import { shows, schedule } from "@/lib/news-data";
import { dbPostToArticle, fetchPublishedPosts } from "@/lib/posts-queries";
import { Calendar, ChevronRight, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WKNA 49 News — Charleston, WV Local News, Weather & Sports" },
      { name: "description", content: "Charleston's Channel 49. Live coverage, local news, weather, and sports for the Kanawha Valley from WKNA-TV 49." },
      { property: "og:title", content: "WKNA 49 News — Charleston's Channel 49" },
      { property: "og:description", content: "Local news, weather, and live coverage for the Kanawha Valley." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": "https://wkna49.com/#website",
              name: "WKNA 49 News",
              url: "https://wkna49.com/",
              publisher: { "@id": "https://wkna49.com/#organization" },
            },
            {
              "@type": "TelevisionStation",
              "@id": "https://wkna49.com/#organization",
              name: "WKNA 49 News",
              alternateName: "WKNA-TV 49",
              url: "https://wkna49.com/",
              areaServed: "Kanawha Valley, West Virginia",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Charleston",
                addressRegion: "WV",
                addressCountry: "US",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: Home,
});

function SectionHead({ title, to, kicker }: { title: string; to?: string; kicker?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3 border-b-2 border-primary pb-2">
      <div>
        {kicker && <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--broadcast)]">{kicker}</p>}
        <h2 className="font-display text-2xl font-black tracking-tight text-primary sm:text-3xl">{title}</h2>
      </div>
      {to && (
        <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--broadcast)] hover:underline" aria-label={`More ${title}`}>
          More {title} <ChevronRight className="size-3" />
        </Link>
      )}
    </div>
  );
}

function Home() {
  const q = useQuery({
    queryKey: ["home-posts"],
    queryFn: () => fetchPublishedPosts({ limit: 30 }),
  });
  const articles = (q.data ?? []).map(dbPostToArticle);
  const [hero, ...rest] = articles;
  const headlines = rest.slice(0, 5);
  const localNews = rest.slice(0, 6);
  const sports = articles.filter((a) => a.category === "Sports");
  const community = articles.filter((a) => a.category === "Community");

  return (
    <Layout>
      <h1 className="sr-only">WKNA 49 News — Charleston's Channel 49 for the Kanawha Valley</h1>
      {hero && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
            <div>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--breaking)]">Top Story</p>
              <ArticleCard a={hero} variant="hero" />
            </div>
            <aside>
              <SectionHead title="Latest Headlines" kicker="On WKNA49.com" />
              <div className="rounded-lg border bg-card p-4">
                {headlines.map((a) => <ArticleCard key={a.slug} a={a} variant="compact" />)}
              </div>
              <div className="mt-5 rounded-lg border bg-[color:var(--ivory)] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--breaking)]">Reader-supported</p>
                <h3 className="mt-1 font-display text-lg font-black text-primary">Help keep WKNA 49 independent</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">Tips and crypto contributions fund local reporting in the Kanawha Valley.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <SupportButton variant="inline" />
                  <Link to="/merch" className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold text-primary hover:bg-accent">
                    <ShoppingBag className="size-4" /> View Our Merch
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div><SectionHead title="WKNA 49 Weather" to="/weather" kicker="Kanawha Valley" /><WeatherCard /></div>
          <div><SectionHead title="Watch Live" to="/watch-live" kicker="Streaming" /><LivePlayer /></div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <SectionHead title="Local News" to="/news" kicker="From the Kanawha Valley" />
        <div className="news-grid">{localNews.map((a) => <ArticleCard key={a.slug} a={a} />)}</div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <SectionHead title="49 Sports" to="/sports" kicker="High school & local" />
            <div className="space-y-4">
              {sports.map((a) => <ArticleCard key={a.slug} a={a} variant="compact" />)}
              <p className="text-sm text-muted-foreground">Full scores, schedules and highlights every Friday night on <em>49 Sports Final</em>.</p>
            </div>
          </div>
          <div>
            <SectionHead title="Community" to="/community" kicker="Around the Valley" />
            <div className="space-y-4">
              {community.map((a) => <ArticleCard key={a.slug} a={a} variant="compact" />)}
              <Link to="/community" className="mt-2 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold text-primary hover:bg-accent">
                <Calendar className="size-4" /> Community Calendar
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <SectionHead title="WKNA 49 Shows" to="/shows" kicker="On Channel 49" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shows.slice(0, 6).map((s) => (
            <Link key={s.slug} to="/shows" className="group flex flex-col rounded-lg border bg-gradient-to-br from-[color:var(--ivory)] to-background p-5 transition-shadow hover:shadow-md">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--broadcast)]">WKNA 49</span>
              <h3 className="mt-2 font-display text-lg font-bold text-primary group-hover:underline">{s.name}</h3>
              <p className="mt-1 text-xs font-semibold text-[color:var(--navy-light)]">{s.time}</p>
              <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-lg border bg-[color:var(--navy-dark)] p-6 text-primary-foreground">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--gold)]">Today on Channel 49</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {schedule.map((s) => (
              <li key={s.name} className="flex items-baseline justify-between gap-3 border-b border-white/10 py-1.5">
                <span className="text-sm font-semibold">{s.name}</span>
                <span className="text-xs text-white/70">{s.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10"><Newsletter /></section>
    </Layout>
  );
}
