import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, Search, Radio, X } from "lucide-react";
import { Logo } from "./Logo";
import { SupportButton } from "./SupportButton";

const NAV = [
  { to: "/news", label: "News" },
  { to: "/weather", label: "Weather" },
  { to: "/sports", label: "Sports" },
  { to: "/watch-live", label: "Watch Live" },
  { to: "/community", label: "Community" },
  { to: "/shows", label: "Shows" },
  { to: "/about", label: "About" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-[color:var(--navy-dark)] text-primary-foreground shadow-md">
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" aria-label="WKNA 49 News home">
            <Logo />
          </Link>
          <div className="hidden items-center gap-2 md:flex">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/60" />
              <input
                type="search"
                placeholder="Search WKNA49.com"
                aria-label="Search the site"
                className="h-9 w-64 rounded-md border border-white/15 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/55 focus:border-[color:var(--gold)] focus:outline-none"
              />
            </div>
            <Link
              to="/watch-live"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[color:var(--breaking)] px-3 text-sm font-semibold uppercase tracking-wide hover:bg-[color:var(--breaking)]/90"
            >
              <Radio className="size-4" />
              Watch Live
            </Link>
            <SupportButton variant="navy" label="Support" />
            <Link
              to="/auth"
              className="inline-flex h-9 items-center rounded-md border border-white/15 px-3 text-xs font-semibold uppercase tracking-wide text-white/80 hover:bg-white/5"
              aria-label="Staff sign in"
            >
              Staff
            </Link>
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
            <Link
              key={n.to}
              to={n.to}
              className="relative px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-white/85 hover:text-white"
              activeProps={{ className: "text-white" }}
              activeOptions={{ exact: false }}
            >
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
      {open && (
        <nav className="border-b border-white/10 bg-[color:var(--navy)] md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1 px-4 py-3">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white/85 hover:bg-white/5"
              >
                {n.label}
              </Link>
            ))}
            <Link
              to="/watch-live"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-[color:var(--breaking)] px-3 py-2 text-sm font-semibold uppercase tracking-wide"
            >
              <Radio className="size-4" /> Watch Live
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
