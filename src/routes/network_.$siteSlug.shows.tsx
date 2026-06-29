import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/site/Layout";
import { TenantNav, TenantHeader } from "@/components/site/TenantNav";
import { useTenantSite } from "@/lib/use-tenant-site";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/network_/$siteSlug/shows")({
  component: TenantShows,
});

const SCHEDULE = [
  { time: "5:00 AM",  show: "Morning Edition",      desc: "Local headlines, weather, and traffic to start your day." },
  { time: "12:00 PM", show: "Newsroom at Noon",     desc: "Midday roundup of breaking stories and community news." },
  { time: "5:00 PM",  show: "Evening Report",       desc: "In-depth coverage of the day's biggest local stories." },
  { time: "6:30 PM",  show: "Network News",         desc: "National and world news from the WKNA 49 network desk." },
  { time: "10:00 PM", show: "Nightly Wrap",         desc: "Tomorrow's forecast, late-breaking news, and sports highlights." },
];

function TenantShows() {
  const tenant = useTenantSite();
  return (
    <Layout>
      <TenantNav tenant={tenant} active="shows" />
      <TenantHeader tenant={tenant} title="Programming Schedule" description="Daily lineup of newscasts and shows." />
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="overflow-hidden rounded-lg border bg-card">
          <ul className="divide-y">
            {SCHEDULE.map((s) => (
              <li key={s.time} className="flex items-start gap-4 p-4">
                <div className="flex w-24 shrink-0 items-center gap-1 text-sm font-bold text-[color:var(--broadcast)]">
                  <Clock className="size-3.5" /> {s.time}
                </div>
                <div>
                  <p className="font-display text-base font-bold text-primary">{s.show}</p>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Schedule subject to change for breaking news coverage.</p>
      </section>
    </Layout>
  );
}
