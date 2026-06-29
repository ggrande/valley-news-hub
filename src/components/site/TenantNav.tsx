import { Link } from "@tanstack/react-router";
import type { TenantSite } from "@/lib/use-tenant-site";

export function TenantNav({ tenant, active }: { tenant: TenantSite; active?: string }) {
  if (!tenant) return null;
  const siteSlug = tenant.slug;
  const items: { to: any; label: string; key: string }[] = [
    { to: "/network_/$siteSlug", label: "Home", key: "home" },
    { to: "/network_/$siteSlug/news", label: "News", key: "news" },
    { to: "/network_/$siteSlug/weather", label: "Weather", key: "weather" },
    { to: "/network_/$siteSlug/sports", label: "Sports", key: "sports" },
    { to: "/network_/$siteSlug/shows", label: "Shows", key: "shows" },
    { to: "/network_/$siteSlug/watch-live", label: "Watch Live", key: "watch" },
    { to: "/network_/$siteSlug/about", label: "About", key: "about" },
    { to: "/network_/$siteSlug/contact", label: "Contact", key: "contact" },
  ];
  return (
    <nav className="border-b bg-[color:var(--navy)] text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-2 text-xs font-bold uppercase tracking-wider">
        {items.map((i) => (
          <Link
            key={i.key}
            to={i.to}
            params={{ siteSlug }}
            className={
              "transition-colors hover:text-[color:var(--gold)] " +
              (active === i.key ? "text-[color:var(--gold)]" : "text-white/85")
            }
          >
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function TenantHeader({ tenant, eyebrow, title, description }: {
  tenant: TenantSite;
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="border-b bg-[color:var(--ivory)]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--broadcast)]">
          {eyebrow ?? `${tenant?.displayName ?? "Station"} · Affiliate of WKNA 49`}
        </p>
        <h1 className="mt-1 font-display text-3xl font-black text-primary sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
    </section>
  );
}
