import { Link } from "@tanstack/react-router";
import type { Article } from "@/lib/news-data";
import { formatDate } from "@/lib/news-data";
import { ArticleImage } from "./ArticleImage";

function Thumb({ a, className }: { a: Article; className: string }) {
  if (a.image) {
    return (
      <div className={"relative overflow-hidden bg-muted " + className}>
        <img
          src={a.image}
          alt={a.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>
    );
  }
  return <ArticleImage hue={a.imageHue} label={a.title} className={className} />;
}

export function ArticleCard({ a, variant = "default" }: { a: Article; variant?: "default" | "compact" | "hero" }) {
  if (variant === "hero") {
    return (
      <Link
        to="/news/$slug"
        params={{ slug: a.slug }}
        className="group grid gap-6 lg:grid-cols-[1.4fr_1fr]"
      >
        <Thumb a={a} className="aspect-[16/10] rounded-lg" />
        <div className="flex flex-col justify-center">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--breaking)]">
            {a.category}
          </span>
          <h2 className="mt-3 font-display text-3xl font-black leading-tight tracking-tight text-primary group-hover:underline sm:text-4xl">
            {a.title}
          </h2>
          <p className="mt-4 font-news text-lg text-muted-foreground">{a.summary}</p>
          <p className="mt-4 text-xs text-muted-foreground">
            By {a.author} • {formatDate(a.date)}
          </p>
        </div>
      </Link>
    );
  }
  if (variant === "compact") {
    return (
      <Link
        to="/news/$slug"
        params={{ slug: a.slug }}
        className="group flex gap-3 border-b py-3 last:border-0"
      >
        <Thumb a={a} className="aspect-square h-20 w-20 shrink-0 rounded" />
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--broadcast)]">
            {a.category}
          </span>
          <h3 className="mt-1 line-clamp-3 font-display text-sm font-bold leading-snug text-primary group-hover:underline">
            {a.title}
          </h3>
        </div>
      </Link>
    );
  }
  return (
    <Link
      to="/news/$slug"
      params={{ slug: a.slug }}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
    >
      <Thumb a={a} className="aspect-[16/10]" />
      <div className="flex flex-1 flex-col p-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--breaking)]">
          {a.category}
        </span>
        <h3 className="mt-2 font-display text-lg font-bold leading-snug tracking-tight text-primary group-hover:underline">
          {a.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{a.summary}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          {a.author} • {formatDate(a.date)}
        </p>
      </div>
    </Link>
  );
}
