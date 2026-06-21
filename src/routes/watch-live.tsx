import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";
import { LivePlayer } from "@/components/site/LivePlayer";
import { schedule } from "@/lib/news-data";

export const Route = createFileRoute("/watch-live")({
  head: () => ({
    meta: [
      { title: "Watch Live — WKNA 49 News Live Stream" },
      { name: "description", content: "Watch WKNA 49 News live during scheduled newscasts, breaking news, severe weather, and special events." },
      { property: "og:url", content: "/watch-live" },
    ],
    links: [{ rel: "canonical", href: "/watch-live" }],
  }),
  component: WatchLive,
});

function WatchLive() {
  return (
    <Layout>
      <PageHeader eyebrow="Streaming" title="Watch WKNA 49 News Live" description="Live coverage of Charleston's Channel 49 — newscasts, breaking news and severe weather." />
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div>
            <LivePlayer large />
            <p className="mt-4 text-sm text-muted-foreground">
              Live coverage appears here during scheduled newscasts, breaking news, severe weather, and special events. If the stream isn't active, check back during one of our newscast windows below.
            </p>
          </div>
          <aside className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-black text-primary">Newscast Schedule</h2>
            <ul className="space-y-3">
              {schedule.map((s) => (
                <li key={s.name} className="border-b pb-3 last:border-0">
                  <p className="font-display font-bold text-primary">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.time}</p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </Layout>
  );
}
