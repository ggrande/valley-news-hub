import { useState } from "react";
import { Menu, Search, Radio, X } from "lucide-react";
import type { TenantSite } from "@/lib/use-tenant-site";

export function TenantHeader({ tenant }: { tenant: NonNullable<TenantSite> }) {
  const [open, setOpen] = useState(false);
  const base = `/network/${tenant.slug}`;
  const NAV = [
    { to: `${base}/news`, label: "News" },
    { to: `${base}/weather`, label: "Weather" },
    { to: `${base}/sports`, label: "Sports" },
    { to: `${base}/watch-live`, label: "Watch Live" },
    { to: `${base}/shows`, label: "Shows" },
    { to: `${base}/about`, label: "About" },
    { to: `${base}/contact`, label: "Contact" },
  ];
  const logoUrl = tenant.logoUrl || "/logo-rect.png";
  const name = tenant.displayName || "Affiliate Station";

  return (
    <header className="sticky top-0 z-40 bg-[color:var(--navy-dark)] text-primary-foreground shadow-md">
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <a href={base} aria-label={`${name} home`} className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt={name}
              width={220}
              height={79}
              className="h-12 w-auto sm:h-14"
              decoding="async"
            />
            <span className="hidden font-display text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--gold)] sm:block">
              Affiliate of WKNA 49
            </span>
          </a>
          <div className="hidden items-center gap-2 md:flex">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/60" />
              <input
                type="search"
                placeholder={`Search ${name}`}
                aria-label="Search this station"
                className="h-9 w-64 rounded-md border border-white/15 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/55 focus:border-[color:var(--gold)] focus:outline-none"
              />
            </div>
            <a
              href={`${base}/watch-live`}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[color:var(--breaking)] px-3 text-sm font-semibold uppercase tracking-wide hover:bg-[color:var(--breaking)]/90"
            >
              <Radio className="size-4" />
              Watch Live
            </a>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="inline-flex size-10 items-center justify-center rounded-md border border-white/15 md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <nav className="hidden border-b border-white/5 bg-[color:var(--navy)] md:block" aria-label="Primary">
        <div className="mx-auto flex max-w-7xl gap-1 px-4">
          {NAV.map((n) => (
            <a
              key={n.to}
              href={n.to}
              className="relative px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-white/85 hover:text-white"
            >
              {n.label}
            </a>
          ))}
        </div>
      </nav>
      {open && (
        <nav className="border-b border-white/10 bg-[color:var(--navy)] md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1 px-4 py-3">
            {NAV.map((n) => (
              <a
                key={n.to}
                href={n.to}
                className="rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white/85 hover:bg-white/5"
              >
                {n.label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
