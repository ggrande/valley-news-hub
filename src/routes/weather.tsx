import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/site/Layout";
import { WeatherCard } from "@/components/site/WeatherCard";
import { forecast as fallbackForecast } from "@/lib/news-data";
import { useWeather } from "@/lib/use-weather";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Droplets, Radar, School, Waves, ShieldCheck, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/weather")({
  head: () => ({
    meta: [
      { title: "Kanawha Valley Weather — WKNA 49 Weather" },
      { name: "description", content: "Current conditions, 7-day forecast, radar, alerts, school closings and river levels from the WKNA 49 Weather team." },
      { property: "og:title", content: "WKNA 49 Weather" },
      { property: "og:description", content: "Kanawha Valley forecast, radar and weather alerts." },
      { property: "og:url", content: "/weather" },
    ],
    links: [{ rel: "canonical", href: "/weather" }],
  }),
  component: WeatherPage,
});

function WeatherPage() {
  const { data, isLoading } = useWeather();
  const days = data?.daily ?? fallbackForecast.map((f) => ({ ...f, code: -1 }));

  return (
    <Layout>
      <PageHeader eyebrow="WKNA 49 Weather" title="Kanawha Valley Forecast" description="Charleston, Saint Albans, South Charleston, Dunbar and the surrounding valley." />
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <WeatherCard />
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-1 font-display text-xl font-bold text-primary">7-Day Forecast</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Live data from Open-Meteo · Charleston, WV {isLoading && "· loading…"}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {days.slice(0, 7).map((d) => (
                  <div key={d.day} className="rounded-md border bg-[color:var(--ivory)] p-3 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--broadcast)]">{d.day}</p>
                    <p className="mt-2 text-2xl font-black text-primary">{d.hi}°</p>
                    <p className="text-xs text-muted-foreground">Low {d.lo}°</p>
                    <p className="mt-1 text-xs">{d.cond}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border bg-[color:var(--navy-dark)]">
              <div className="flex items-center justify-between px-4 py-2 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--gold)]">
                  <Radar className="mr-1 inline size-3.5" /> WKNA 49 Live Radar
                </p>
                <p className="text-[10px] text-white/60">Powered by Windy.com</p>
              </div>
              <div className="aspect-[16/9] w-full">
                <iframe
                  title="Kanawha Valley live radar"
                  src="https://embed.windy.com/embed2.html?lat=38.35&lon=-81.63&detailLat=38.35&detailLon=-81.63&zoom=8&level=surface&overlay=radar&product=radar&menu=&message=true&marker=true&calendar=&pressure=&type=map&location=coordinates&metricWind=mph&metricTemp=%C2%B0F&radarRange=-1"
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <p className="px-4 py-2 text-xs text-white/70">
                Animated radar coverage for Kanawha, Putnam, Boone, Clay, Lincoln and Fayette counties.
              </p>
            </div>
          </div>
          <aside className="space-y-6">
            <Panel icon={<AlertTriangle className="size-4" />} title="Active Weather Alerts" tone="alert">
              <p>Heat advisory in effect for portions of the Kanawha Valley through Tuesday evening.</p>
              <p className="mt-2 text-xs text-muted-foreground">Source: WKNA 49 Weather Center</p>
            </Panel>
            <Panel icon={<School className="size-4" />} title="School Closings & Delays">
              <ClosingsSummary />
            </Panel>
            <Panel icon={<Waves className="size-4" />} title="River Levels">
              <ul className="space-y-1 text-sm">
                <li className="flex justify-between"><span>Kanawha — Charleston</span><span className="font-semibold">18.4 ft</span></li>
                <li className="flex justify-between"><span>Elk — Queen Shoals</span><span className="font-semibold">6.1 ft</span></li>
                <li className="flex justify-between"><span>Coal — Tornado</span><span className="font-semibold">4.2 ft</span></li>
              </ul>
            </Panel>
            <Panel icon={<Droplets className="size-4" />} title="Storm Preparedness">
              <p>Have a charged phone, flashlight, and a weather radio handy during storm season.</p>
            </Panel>
            <Panel icon={<ShieldCheck className="size-4" />} title="Submit Storm Photos">
              <p>Send safe storm photos and video to <a href="mailto:weather@wkna49.com" className="text-[color:var(--broadcast)] underline">weather@wkna49.com</a>.</p>
            </Panel>
          </aside>
        </div>
      </section>
    </Layout>
  );
}

function Panel({ icon, title, children, tone }: { icon: React.ReactNode; title: string; children: React.ReactNode; tone?: "alert" }) {
  return (
    <div className={"rounded-lg border bg-card p-5 " + (tone === "alert" ? "border-[color:var(--breaking)]/50 bg-[color:var(--breaking)]/5" : "")}>
      <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-primary">
        {icon}{title}
      </h3>
      <div className="mt-3 text-sm">{children}</div>
    </div>
  );
}

function ClosingsSummary() {
  const q = useQuery({
    queryKey: ["closings-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("closings" as never).select("id,status");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; status: string }[];
    },
    refetchInterval: 60_000,
  });
  const count = q.data?.length ?? 0;
  return (
    <>
      {count === 0 ? (
        <p className="text-sm text-muted-foreground">No closings or delays reported.</p>
      ) : (
        <p className="text-sm">
          <span className="font-bold text-[color:var(--breaking)]">{count}</span> active {count === 1 ? "closing or delay" : "closings and delays"} across the Kanawha Valley.
        </p>
      )}
      <Link to="/weather/closings" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--broadcast)] hover:underline">
        View full WV closings tracker <ChevronRight className="size-3" />
      </Link>
    </>
  );
}
