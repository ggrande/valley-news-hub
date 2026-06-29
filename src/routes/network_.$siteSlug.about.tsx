import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/site/Layout";
import { TenantNav, TenantHeader } from "@/components/site/TenantNav";
import { useTenantSite } from "@/lib/use-tenant-site";

export const Route = createFileRoute("/network_/$siteSlug/about")({
  component: TenantAbout,
});

function TenantAbout() {
  const tenant = useTenantSite();
  const place = tenant?.city && tenant?.region ? `${tenant.city}, ${tenant.region}` : "the community we serve";
  const name = tenant?.displayName ?? "Our station";
  return (
    <Layout>
      <TenantNav tenant={tenant} active="about" />
      <TenantHeader tenant={tenant} title={`About ${name}`} description={tenant?.tagline ?? `Local news, weather, and stories for ${place}.`} />
      <article className="mx-auto max-w-3xl px-4 py-10 font-news text-lg leading-relaxed text-foreground">
        <p>
          {name} is a proud affiliate of the WKNA 49 news network, delivering local reporting,
          weather, and live updates to {place}. We blend trusted national coverage from the WKNA 49
          newsroom with the stories that matter most to our hometown.
        </p>
        <p className="mt-5">
          Our newsroom believes in journalism that's accurate, accessible, and accountable to the
          neighborhoods we serve. Have a story tip, correction, or community event to share? We'd love
          to hear from you — visit our <a href={`/network/${tenant?.slug}/contact`} className="text-[color:var(--broadcast)] underline">contact page</a> to get in touch.
        </p>
        <h2 className="mt-10 font-display text-2xl font-black text-primary">Our coverage</h2>
        <ul className="mt-3 space-y-2 text-base">
          <li>• Breaking local news and public-safety updates</li>
          <li>• Hyperlocal weather powered by your ZIP code</li>
          <li>• High school and community sports</li>
          <li>• Live programming and community events</li>
          <li>• Investigative reporting from the WKNA 49 network</li>
        </ul>
        <h2 className="mt-10 font-display text-2xl font-black text-primary">Part of the WKNA 49 Network</h2>
        <p className="mt-3">
          As an affiliate station, we share editorial standards and corrections policy with WKNA 49.
          Network stories appear alongside our local reporting, and our team curates what runs here.
        </p>
      </article>
    </Layout>
  );
}
