import { createFileRoute, Link, Outlet, notFound } from "@tanstack/react-router";
import { getTenantBySlug } from "@/lib/network-feed.functions";

export const Route = createFileRoute("/network_/$siteSlug")({
  loader: async ({ params }) => {
    const tenant = await getTenantBySlug({ data: { slug: params.siteSlug } });
    if (!tenant) throw notFound();
    return { tenant };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.tenant;
    if (!t) return {};
    const suspended = t.status === "suspended";
    return {
      meta: [
        {
          title: suspended
            ? `${t.displayName} — Station paused`
            : `${t.displayName} — Affiliate Station of WKNA 49`,
        },
        {
          name: "robots",
          content: suspended ? "noindex,nofollow" : "index,follow",
        },
        { property: "og:site_name", content: t.displayName },
      ],
    };
  },
  component: TenantLayout,
});

function TenantLayout() {
  const { tenant } = Route.useLoaderData();
  if (tenant.status === "suspended") return <SuspendedStation tenant={tenant} />;
  return <Outlet />;
}

function SuspendedStation({ tenant }: { tenant: { displayName: string; slug: string } }) {
  return (
    <main className="min-h-dvh bg-[color:var(--ivory)] px-6 py-16">
      <div className="mx-auto max-w-xl rounded-lg border bg-white p-8 text-center shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--gold)]">
          Affiliate of WKNA 49
        </p>
        <h1 className="mt-2 font-display text-3xl font-black text-primary">
          {tenant.displayName} is paused
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This station is temporarily offline while the owner updates their subscription. Please
          check back soon — most stations return within a few days.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/network/stations"
            className="h-10 rounded-md border px-4 text-sm font-semibold leading-10"
          >
            Browse other stations
          </Link>
          <a
            href={`/station/admin?site=${encodeURIComponent(tenant.slug)}`}
            className="h-10 rounded-md bg-primary px-4 text-sm font-semibold leading-10 text-primary-foreground"
          >
            I'm the owner — reactivate
          </a>
        </div>
      </div>
    </main>
  );
}
