import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/site/Layout";
import { TenantNav, TenantHeader } from "@/components/site/TenantNav";
import { useTenantSite } from "@/lib/use-tenant-site";
import { Radio } from "lucide-react";

export const Route = createFileRoute("/network_/$siteSlug/watch-live")({
  component: TenantWatchLive,
});

function TenantWatchLive() {
  const tenant = useTenantSite();
  return (
    <Layout>
      <TenantNav tenant={tenant} active="watch" />
      <TenantHeader tenant={tenant} title="Watch Live" description="Live newscasts, breaking-news coverage, and community events." />
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="overflow-hidden rounded-lg border bg-[color:var(--navy-dark)] text-white">
          <div className="flex aspect-video w-full items-center justify-center bg-black/60">
            <div className="text-center">
              <Radio className="mx-auto size-10 text-[color:var(--gold)]" />
              <p className="mt-3 font-display text-xl font-black">Currently off-air</p>
              <p className="mt-1 text-sm text-white/70">
                Our next scheduled newscast will stream here. Check the <a href={`/network/${tenant?.slug}/shows`} className="underline">programming schedule</a> for times.
              </p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Live streaming is available during scheduled newscasts and breaking-news coverage.
        </p>
      </section>
    </Layout>
  );
}
