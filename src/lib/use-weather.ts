import { useQuery } from "@tanstack/react-query";

export type DailyForecast = {
  day: string;
  hi: number;
  lo: number;
  cond: string;
  code: number;
};

export type CurrentWeather = {
  temp: number;
  cond: string;
  code: number;
  windMph: number;
  windDir: string;
  humidity: number;
};

export type WeatherData = {
  current: CurrentWeather;
  daily: DailyForecast[];
};

// Charleston, WV
const LAT = 38.3498;
const LON = -81.6326;

const WMO: Record<number, string> = {
  0: "Sunny",
  1: "Mostly Sunny",
  2: "Partly Cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  66: "Freezing Rain",
  67: "Freezing Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  77: "Snow Grains",
  80: "Showers",
  81: "Showers",
  82: "Heavy Showers",
  85: "Snow Showers",
  86: "Snow Showers",
  95: "T-storms",
  96: "T-storms w/ Hail",
  99: "Severe T-storms",
};

function cond(code: number) {
  return WMO[code] ?? "—";
}

function degToCompass(d: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(d / 45) % 8];
}

function dayLabel(iso: string, idx: number) {
  if (idx === 0) return "Today";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

async function fetchWeather(): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather fetch failed");
  const j = await res.json();
  const current: CurrentWeather = {
    temp: Math.round(j.current.temperature_2m),
    cond: cond(j.current.weather_code),
    code: j.current.weather_code,
    windMph: Math.round(j.current.wind_speed_10m),
    windDir: degToCompass(j.current.wind_direction_10m),
    humidity: Math.round(j.current.relative_humidity_2m),
  };
  const daily: DailyForecast[] = j.daily.time.map((t: string, i: number) => ({
    day: dayLabel(t, i),
    hi: Math.round(j.daily.temperature_2m_max[i]),
    lo: Math.round(j.daily.temperature_2m_min[i]),
    cond: cond(j.daily.weather_code[i]),
    code: j.daily.weather_code[i],
  }));
  return { current, daily };
}

export function useWeather() {
  return useQuery({
    queryKey: ["weather", "charleston-wv"],
    queryFn: fetchWeather,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
