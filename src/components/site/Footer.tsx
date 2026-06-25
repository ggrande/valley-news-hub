import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { SupportButton } from "./SupportButton";
import { useSiteContent } from "@/lib/use-site-content";

const COLS: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: "Newsroom",
    links: [
      { to: "/news", label: "News" },
      { to: "/weather", label: "Weather" },
      { to: "/sports", label: "Sports" },
      { to: "/watch-live", label: "Watch Live" },
      { to: "/community", label: "Community" },
      { to: "/shows", label: "Shows" },
    ],
  },
  {
    title: "Station",
    links: [
      { to: "/about", label: "About WKNA-TV" },
      { to: "/contact", label: "Contact" },
      { to: "/advertise", label: "Advertise" },
      { to: "/careers", label: "Careers" },
      { to: "/submit-news-tip", label: "Submit a News Tip" },
    ],
  },
  {
    title: "Policies",
    links: [
      { to: "/corrections-policy", label: "Corrections Policy" },
      { to: "/privacy-policy", label: "Privacy Policy" },
      { to: "/terms-of-use", label: "Terms of Use" },
      { to: "/accessibility", label: "Accessibility" },
      { to: "/public-file", label: "Public File / EEO" },
    ],
  },
];

type Branding = { name: string; tagline: string };
type Contact = { business_address: string; news_tip_email: string; legal_entity_name: string };
type Social = { twitter?: string; facebook?: string; instagram?: string; youtube?: string; tiktok?: string };

export function Footer() {
  const branding = useSiteContent<Branding>("branding", {
    name: "WKNA 49 News",
    tagline: "Local News for the Kanawha Valley",
  });
  const contact = useSiteContent<Contact>("contact", {
    business_address: "Charleston, West Virginia",
    news_tip_email: "news@wkna49.com",
    legal_entity_name: "WKNA-TV 49",
  });
  const social = useSiteContent<Social>("social_links", {});

  const socialEntries = Object.entries(social).filter(([, v]) => v && String(v).trim());

  return (
    <footer className="mt-16 bg-[color:var(--navy-dark)] text-primary-foreground">
      <div className="mountain-line h-10" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-white/75">
            {branding.tagline}. {branding.name} brings Charleston and the surrounding communities trusted local coverage.
          </p>
          <address className="mt-4 text-sm not-italic text-white/70">
            {contact.business_address}
            <br />
            Newsroom: <a href={`mailto:${contact.news_tip_email}`} className="hover:text-white">{contact.news_tip_email}</a>
          </address>
          {socialEntries.length > 0 && (
            <ul className="mt-3 flex gap-3 text-xs">
              {socialEntries.map(([k, v]) => (
                <li key={k}>
                  <a href={v as string} target="_blank" rel="noreferrer" className="text-white/70 hover:text-white capitalize">
                    {k}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5"><SupportButton variant="navy" /></div>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--gold)]">
              {col.title}
            </h4>
            <ul className="mt-4 space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-white/80 hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 px-4 py-5 text-xs text-white/60 sm:flex-row">
          <p>© {new Date().getFullYear()} {contact.legal_entity_name} • {branding.name} • {contact.business_address}</p>
          <div className="flex items-center gap-4">
            <p>{branding.tagline}</p>
            <Link to="/auth" className="hover:text-white">Staff</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
