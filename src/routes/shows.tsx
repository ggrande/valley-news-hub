import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";
import { shows } from "@/lib/news-data";

export const Route = createFileRoute("/shows")({
  head: () => ({
    meta: [
      { title: "Shows — WKNA 49 News" },
      { name: "description", content: "Newscasts and programs on WKNA-TV 49 — Charleston's Channel 49." },
      { property: "og:url", content: "/shows" },
    ],
    links: [{ rel: "canonical", href: "/shows" }],
  }),
  component: ShowsPage,
});

function ShowsPage() {
  return (
    <Layout>
      <PageHeader eyebrow="On Channel 49" title="WKNA 49 Shows" description="Local newscasts and programs from Charleston's Channel 49." />
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shows.map((s) => (
            <article key={s.slug} className="overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md">
              <div className="relative aspect-[16/9] bg-gradient-to-br from-[color:var(--navy)] to-[color:var(--broadcast)] p-5 text-white">
                <div className="mountain-line absolute inset-x-0 bottom-0 h-8 opacity-60" aria-hidden="true" />
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--gold)]">WKNA 49</p>
                <h2 className="mt-2 font-display text-xl font-black leading-tight">{s.name}</h2>
                <p className="absolute bottom-3 right-4 text-xs font-semibold text-white/85">{s.time}</p>
              </div>
              <div className="p-5">
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </Layout>
  );
}
