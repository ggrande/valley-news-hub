import type { TenantSite } from "@/lib/use-tenant-site";

export function TenantNav({ tenant, active }: { tenant: TenantSite; active?: string }) {
  if (!tenant) return null;
  const base = `/network/${tenant.slug}`;
  const items: { href: string; label: string; key: string }[] = [
    { href: `${base}`, label: "Home", key: "home" },
    { href: `${base}/news`, label: "News", key: "news" },
    { href: `${base}/weather`, label: "Weather", key: "weather" },
    { href: `${base}/sports`, label: "Sports", key: "sports" },
    { href: `${base}/shows`, label: "Shows", key: "shows" },
    { href: `${base}/watch-live`, label: "Watch Live", key: "watch" },
    { href: `${base}/about`, label: "About", key: "about" },
    { href: `${base}/contact`, label: "Contact", key: "contact" },
  ];
  return (
    <nav className="border-b bg-[color:var(--navy)] text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-2 text-xs font-bold uppercase tracking-wider">
        {items.map((i) => (
          <a
            key={i.key}
            href={i.href}
            className={
              "transition-colors hover:text-[color:var(--gold)] " +
              (active === i.key ? "text-[color:var(--gold)]" : "text-white/85")
            }
          >
            {i.label}
          </a>
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
