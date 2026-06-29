import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/site/Layout";
import { TenantNav, TenantHeader } from "@/components/site/TenantNav";
import { useTenantSite } from "@/lib/use-tenant-site";
import { Cloud, CloudRain, Sun, CloudSun, Snowflake, CloudFog, Zap, AlertTriangle, MapPin } from "lucide-react";

export const Route = createFileRoute("/network_/$siteSlug/weather")({
  component: TenantWeather,
});

type Daily = { day: string; hi: number; lo: number; cond: string; code: number };

function wmo(code: number): string {
  const m: Record<number, string> = {
    0: "Sunny", 1: "Mostly Sunny", 2: "Partly Cloudy", 3: "Cloudy",
    45: "Fog", 48: "Fog", 51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle",
    61: "Light Rain", 63: "Rain", 65: "Heavy Rain", 66: "Freezing Rain", 67: "Freezing Rain",
    71: "Light Snow", 73: "Snow", 75: "Heavy Snow", 80: "Showers", 81: "Showers",
    82: "Heavy Showers", 85: "Snow Showers", 86: "Snow Showers", 95: "T-storms",
    96: "T-storms w/ Hail", 99: "Severe T-storms",
  };
  return m[code] ?? "—";
}

function icon(code: number) {
  if (code >= 95) return <Zap className="size-5" />;
  if (code >= 71 && code <= 86) return <Snowflake className="size-5" />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain className="size-5" />;
  if (code === 45 || code === 48) return <CloudFog className="size-5" />;
  if (code === 0 || code === 1) return <Sun className="size-5" />;
  if (code === 2) return <CloudSun className="size-5" />;
  return <Cloud className="size-5" />;
}

function dayLabel(iso: string, i: number) {
  if (i === 0) return "Today";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

function TenantWeather() {
  const tenant = useTenantSite();
  const lat = tenant?.latitude;
  const lon = tenant?.longitude;
  const placeLabel = tenant?.city && tenant?.region ? `${tenant.city}, ${tenant.region}` : (tenant?.zipCode ?? "your area");

  const q = useQuery({
    queryKey: ["tenant-weather", lat, lon],
    enabled: typeof lat === "number" && typeof lon === "number",
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=7`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("weather fetch failed");
      const j = await r.json();
      const days: Daily[] = j.daily.time.map((t: string, i: number) => ({
        day: dayLabel(t, i),
        hi: Math.round(j.daily.temperature_2m_max[i]),
        lo: Math.round(j.daily.temperature_2m_min[i]),
        cond: wmo(j.daily.weather_code[i]),
        code: j.daily.weather_code[i],
      }));
      return {
        current: {
          temp: Math.round(j.current.temperature_2m),
          cond: wmo(j.current.weather_code),
          code: j.current.weather_code,
          windMph: Math.round(j.current.wind_speed_10m),
          humidity: Math.round(j.current.relative_humidity_2m),
        },
        days,
      };
    },
  });

  return (
    <Layout>
      <TenantNav tenant={tenant} active="weather" />
      <TenantHeader tenant={tenant} title={`${placeLabel} Forecast`} description="Live local conditions and 7-day outlook." />
      <section className="mx-auto max-w-7xl px-4 py-8">
        {!lat || !lon ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Weather not configured</p>
            <p className="mt-1">This station hasn't set its ZIP code yet. The station admin can add it from Branding &amp; Location.</p>
          </div>
        ) : q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading conditions…</p>
        ) : q.error ? (
          <p className="text-sm text-muted-foreground">Couldn't load conditions. Try again shortly.</p>
        ) : q.data && (
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-lg border bg-gradient-to-br from-[color:var(--navy)] to-[color:var(--broadcast)] p-6 text-white shadow-sm">
              <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-white/70">
                <MapPin className="size-3" /> {placeLabel}
              </p>
              <p className="mt-2 font-display text-6xl font-black">{q.data.current.temp}°</p>
              <p className="mt-1 text-lg">{q.data.current.cond}</p>
              <div className="mt-4 grid grid-cols-7 gap-2 border-t border-white/15 pt-4 text-center text-xs">
                {q.data.days.slice(0, 7).map((d) => (
                  <div key={d.day} className="flex flex-col items-center gap-1">
                    <span className="font-semibold">{d.day}</span>
                    <span className="text-white/80">{icon(d.code)}</span>
                    <span>{d.hi}°<span className="text-white/55"> / {d.lo}°</span></span>
                  </div>
                ))}
              </div>
            </div>
            <aside className="space-y-4">
              <div className="rounded-lg border bg-card p-5">
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">Right now</h3>
                <ul className="mt-3 space-y-1 text-sm">
                  <li className="flex justify-between"><span>Wind</span><span className="font-semibold">{q.data.current.windMph} mph</span></li>
                  <li className="flex justify-between"><span>Humidity</span><span className="font-semibold">{q.data.current.humidity}%</span></li>
                  <li className="flex justify-between"><span>Conditions</span><span className="font-semibold">{q.data.current.cond}</span></li>
                </ul>
              </div>
              <div className="overflow-hidden rounded-lg border">
                <iframe
                  title="Local radar"
                  src={`https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&zoom=8&level=surface&overlay=radar&product=radar&menu=&message=true&marker=true&type=map&metricWind=mph&metricTemp=%C2%B0F`}
                  className="aspect-[4/3] w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </aside>
          </div>
        )}
      </section>
    </Layout>
  );
}
