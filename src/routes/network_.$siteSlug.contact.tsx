import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/site/Layout";
import { TenantNav, TenantHeader } from "@/components/site/TenantNav";
import { useTenantSite } from "@/lib/use-tenant-site";
import { Mail, Phone, MapPin } from "lucide-react";

export const Route = createFileRoute("/network_/$siteSlug/contact")({
  component: TenantContact,
});

function TenantContact() {
  const tenant = useTenantSite();
  const place = tenant?.city && tenant?.region ? `${tenant.city}, ${tenant.region}` : null;
  return (
    <Layout>
      <TenantNav tenant={tenant} active="contact" />
      <TenantHeader tenant={tenant} title="Contact the newsroom" description="Story tips, corrections, community events, and feedback." />
      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-display text-xl font-black text-primary">Get in touch</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {tenant?.contactEmail && (
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-[color:var(--broadcast)]" />
                <a href={`mailto:${tenant.contactEmail}`} className="text-[color:var(--broadcast)] underline">{tenant.contactEmail}</a>
              </li>
            )}
            {tenant?.contactPhone && (
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-[color:var(--broadcast)]" />
                <a href={`tel:${tenant.contactPhone.replace(/[^\d+]/g, "")}`} className="text-[color:var(--broadcast)] underline">{tenant.contactPhone}</a>
              </li>
            )}
            {place && (
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-[color:var(--broadcast)]" />
                {place}{tenant?.zipCode ? ` ${tenant.zipCode}` : ""}
              </li>
            )}
            {!tenant?.contactEmail && !tenant?.contactPhone && (
              <li className="text-muted-foreground">Contact details coming soon.</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-display text-xl font-black text-primary">Send a tip</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We rely on neighbors like you. If you saw something newsworthy, send a quick note
            — include the location and time, and a photo if it's safe to share.
          </p>
          <a
            href={tenant?.contactEmail ? `mailto:${tenant.contactEmail}?subject=News%20tip` : "mailto:news@wkna49.com?subject=News%20tip"}
            className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Email the newsroom
          </a>
        </div>
      </section>
    </Layout>
  );
}
