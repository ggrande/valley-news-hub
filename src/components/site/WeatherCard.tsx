import { Cloud, CloudRain, Sun, CloudSun } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { forecast } from "@/lib/news-data";

function icon(cond: string) {
  if (cond.toLowerCase().includes("storm") || cond.toLowerCase().includes("shower")) return <CloudRain className="size-5" />;
  if (cond.toLowerCase().includes("sunny")) return <Sun className="size-5" />;
  if (cond.toLowerCase().includes("partly")) return <CloudSun className="size-5" />;
  return <Cloud className="size-5" />;
}

export function WeatherCard() {
  const today = forecast[0];
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
          <p className="mt-1 font-display text-4xl font-black">78°</p>
          <p className="text-sm text-white/85">{today.cond}</p>
        </div>
        <div className="text-right text-xs text-white/80">
          <p>Hi {today.hi}° / Lo {today.lo}°</p>
          <p className="mt-1">Wind W 8 mph</p>
          <p>Humidity 64%</p>
        </div>
      </div>
      <div className="grid grid-cols-7 border-t border-white/10 bg-black/15 text-center text-[11px]">
        {forecast.map((d) => (
          <div key={d.day} className="flex flex-col items-center gap-1 px-1 py-2">
            <span className="font-semibold">{d.day}</span>
            <span className="text-white/80">{icon(d.cond)}</span>
            <span>{d.hi}°<span className="text-white/55"> / {d.lo}°</span></span>
          </div>
        ))}
      </div>
    </Link>
  );
}
