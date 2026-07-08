import type { TenantSite } from "@/lib/use-tenant-site";

export function TenantFooter({ tenant }: { tenant: NonNullable<TenantSite> }) {
  const base = `/network/${tenant.slug}`;
  const name = tenant.displayName || "Affiliate Station";
  const tagline = tenant.tagline || "An independent affiliate of the WKNA 49 News Network.";
  const location = [tenant.city, tenant.region].filter(Boolean).join(", ");
  const contactEmail = tenant.contactEmail;
  const logoUrl = tenant.logoUrl || "/logo-rect.png";

  const COLS: { title: string; links: { to: string; label: string }[] }[] = [
    {
      title: "Newsroom",
      links: [
        { to: `${base}/news`, label: "News" },
        { to: `${base}/weather`, label: "Weather" },
        { to: `${base}/sports`, label: "Sports" },
        { to: `${base}/watch-live`, label: "Watch Live" },
        { to: `${base}/shows`, label: "Shows" },
      ],
    },
    {
      title: "Station",
      links: [
        { to: `${base}/about`, label: `About ${name}` },
        { to: `${base}/contact`, label: "Contact" },
      ],
    },
    {
      title: "Policies",
      links: [
        { to: `${base}/privacy`, label: "Privacy Policy" },
        { to: `${base}/terms`, label: "Terms of Use" },
        { to: `${base}/dmca`, label: "DMCA" },
      ],
    },
    {
      title: "Network",
      links: [
        { to: `/network/stations`, label: "Affiliate Directory" },
        { to: `/network`, label: "About WKNA 49 Network" },
      ],
    },
  ];

  return (
    <footer className="mt-16 bg-[color:var(--navy-dark)] text-primary-foreground">
      <div className="mountain-line h-10" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <img src={logoUrl} alt={name} className="h-12 w-auto" />
          <p className="mt-4 max-w-xs text-sm text-white/75">{tagline}</p>
          {(location || contactEmail) && (
            <address className="mt-4 text-sm not-italic text-white/70">
              {location && <>{location}<br /></>}
              {contactEmail && (
                <>Newsroom: <a href={`mailto:${contactEmail}`} className="hover:text-white">{contactEmail}</a></>
              )}
            </address>
          )}
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--gold)]">
              {col.title}
            </h4>
            <ul className="mt-4 space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.to}>
                  <a href={l.to} className="text-white/80 hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 px-4 py-5 text-xs text-white/60 sm:flex-row">
          <p>© {new Date().getFullYear()} {name} • Affiliate of WKNA 49</p>
          <div className="flex items-center gap-4">
            <a href={`${base}/admin`} className="hover:text-white">Station Admin</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
