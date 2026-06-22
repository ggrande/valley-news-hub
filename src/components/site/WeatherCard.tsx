import { Cloud, CloudRain, Sun, CloudSun, Snowflake, CloudFog, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { forecast as fallback } from "@/lib/news-data";
import { useWeather, type DailyForecast } from "@/lib/use-weather";

function icon(code: number, condText: string) {
  if (code >= 95) return <Zap className="size-5" />;
  if (code >= 71 && code <= 86) return <Snowflake className="size-5" />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain className="size-5" />;
  if (code === 45 || code === 48) return <CloudFog className="size-5" />;
  if (code === 0 || code === 1) return <Sun className="size-5" />;
  if (code === 2) return <CloudSun className="size-5" />;
  if (condText.toLowerCase().includes("sun")) return <Sun className="size-5" />;
  return <Cloud className="size-5" />;
}

export function WeatherCard() {
  const { data } = useWeather();
  const days: (DailyForecast & { code: number })[] = data?.daily?.length
    ? data.daily
    : fallback.map((f) => ({ ...f, code: -1 }));
  const today = days[0];
  const current = data?.current;

  return (
    <Link
      to="/weather"
      className="block overflow-hidden rounded-lg border bg-gradient-to-br from-[color:var(--navy)] to-[color:var(--broadcast)] text-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
            Charleston, WV
          </p>
          <p className="mt-1 font-display text-4xl font-black">
            {current ? `${current.temp}°` : `${today.hi}°`}
          </p>
          <p className="text-sm text-white/85">{current?.cond ?? today.cond}</p>
        </div>
        <div className="text-right text-xs text-white/80">
          <p>Hi {today.hi}° / Lo {today.lo}°</p>
          <p className="mt-1">
            Wind {current ? `${current.windDir} ${current.windMph} mph` : "—"}
          </p>
          <p>Humidity {current ? `${current.humidity}%` : "—"}</p>
        </div>
      </div>
      <div className="grid grid-cols-7 border-t border-white/10 bg-black/15 text-center text-[11px]">
        {days.slice(0, 7).map((d) => (
          <div key={d.day} className="flex flex-col items-center gap-1 px-1 py-2">
            <span className="font-semibold">{d.day}</span>
            <span className="text-white/80">{icon(d.code ?? -1, d.cond)}</span>
            <span>{d.hi}°<span className="text-white/55"> / {d.lo}°</span></span>
          </div>
        ))}
      </div>
    </Link>
  );
}
