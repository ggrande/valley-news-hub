import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Layout, PageHeader } from "@/components/site/Layout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [
      { title: "Join Our Network — Run Your Own WKNA-49 Style News Site" },
      { name: "description", content: "License the WKNA-49 news platform or get a managed mirror. Self-host for a one-time fee, or let us run it for you with automatic updates you approve." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Join the WKNA-49 Network" },
      { property: "og:description", content: "Build your own AI-powered local news site. Self-host or fully managed." },
    ],
  }),
  component: NetworkPage,
  errorComponent: ({ error }) => <Layout><div className="p-12 text-center text-red-600">{error.message}</div></Layout>,
  notFoundComponent: () => <Layout><div className="p-12 text-center">Not found.</div></Layout>,
});

const FAQS: { q: string; a: string }[] = [
  { q: "Who owns the content I publish?", a: "You do. Both tiers give you full ownership of articles, branding, and subscriber data." },
  { q: "Can I switch between tiers?", a: "Yes. Move from self-hosted to managed (or back) at any time — your license entitles you to either." },
  { q: "Do I need to know how to code?", a: "Self-host requires basic Git/deploy comfort. Managed Mirror requires none — we handle everything." },
  { q: "What does 'scrubbed' source mean?", a: "The release ZIP strips our private credentials, station data, and operational secrets so you start with a clean slate." },
  { q: "Is AI usage included?", a: "Self-hosters bring their own AI Gateway key (covered by Lovable Cloud free tier for most stations). Managed includes generous usage." },
  { q: "How do refunds work?", a: "Self-host: 14-day money-back if you haven't downloaded. Managed: cancel anytime, prorated to the day." },
];

function NetworkPage() {
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();
  const [email, setEmail] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? undefined);
      setUserId(data.user?.id);
    });
  }, []);

  return (
    <Layout>
      <PaymentTestModeBanner />
      <PageHeader
        eyebrow="Join Our Network"
        title="Run your own WKNA-49 style newsroom"
        description="License the platform we built to power WKNA 49 News — AI-curated stories, automated Reddit ingestion, full SEO, and a beautiful broadcast-style design. Pick the model that fits you."
      />
      <section className="mx-auto max-w-6xl px-4 py-12 grid gap-6 md:grid-cols-2">
        <PlanCard
          tier="self_host_license"
          name="Self-Host License"
          price="$49.99"
          unit="one-time"
          tagline="Own it. Deploy it anywhere."
          features={[
            "Full scrubbed source code",
            "One-click Netlify deploy template",
            "Update notifications + downloads",
            "Editable site content (About, branding, contact info)",
            "Bring your own Lovable Cloud, AI, and domain",
            "Community support",
          ]}
          cta="Get the license"
          onClick={() =>
            openCheckout({
              priceId: "network_self_host_license_onetime",
              tier: "self_host_license",
              customerEmail: email,
              userId,
            })
          }
        />
        <PlanCard
          tier="managed_mirror"
          name="Managed Mirror"
          price="$9.99"
          unit="per month"
          tagline="We run it. You publish."
          features={[
            "We host & maintain everything",
            "Automatic updates — accept or reject each release",
            "Per-site CMS for all branding & policies",
            "Reddit automation included",
            "Custom domain support",
            "Priority email support",
          ]}
          cta="Start subscription"
          featured
          onClick={() =>
            openCheckout({
              priceId: "network_managed_mirror_monthly",
              tier: "managed_mirror",
              customerEmail: email,
              userId,
            })
          }
        />
      </section>

      <section className="border-t bg-[color:var(--ivory)]">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <h2 className="font-display text-3xl font-black text-primary">How updates work</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold text-primary">Self-hosters</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Every release we ship to WKNA-49 is published to the network with a versioned ZIP and changelog. You'll see an update banner in your admin dashboard with a one-click download.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-primary">Managed mirrors</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Updates are staged for you. When a new release is ready, you'll get an in-app prompt to <strong>accept</strong> or <strong>reject</strong> it — no surprise changes to your live site.
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/network/changelog" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold">View full changelog →</Link>
            <Link to="/network/docs" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold">Self-host setup guide →</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12">
        <h2 className="font-display text-3xl font-black text-primary">Frequently asked</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {FAQS.map((f) => (
            <div key={f.q} className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold text-primary">{f.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <Dialog open={isOpen} onOpenChange={(o) => !o && closeCheckout()}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Complete your order</DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto p-2">{checkoutElement}</div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function PlanCard({
  name, price, unit, tagline, features, cta, onClick, featured,
}: {
  tier: string; name: string; price: string; unit: string; tagline: string;
  features: string[]; cta: string; onClick: () => void; featured?: boolean;
}) {
  return (
    <div className={`flex flex-col rounded-2xl border-2 bg-card p-8 shadow-sm ${featured ? "border-[color:var(--breaking)]" : "border-border"}`}>
      {featured && <span className="self-start rounded-full bg-[color:var(--breaking)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">Most popular</span>}
      <h3 className="mt-3 font-display text-2xl font-black text-primary">{name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
      <div className="mt-6 flex items-baseline gap-2">
        <span className="font-display text-5xl font-black text-primary">{price}</span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <ul className="mt-6 flex-1 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-2"><span className="text-[color:var(--broadcast)]">✓</span><span>{f}</span></li>
        ))}
      </ul>
      <button
        onClick={onClick}
        className={`mt-8 h-11 w-full rounded-md text-sm font-semibold ${featured ? "bg-[color:var(--breaking)] text-white" : "bg-primary text-primary-foreground"}`}
      >
        {cta}
      </button>
    </div>
  );
}
