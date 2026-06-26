import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Layout, PageHeader } from "@/components/site/Layout";
import { listPublicAffiliateStations, type PublicStation } from "@/lib/affiliate-directory.functions";

const stationsQuery = queryOptions({
  queryKey: ["public-affiliate-stations"],
  queryFn: () => listPublicAffiliateStations(),
});

export const Route = createFileRoute("/network/stations")({
  head: () => ({
    meta: [
      { title: "Affiliate Stations — The WKNA-49 Affiliate Network" },
      {
        name: "description",
        content:
          "Newsrooms running on the WKNA-49 platform. Every affiliate station is independently owned and operated.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(stationsQuery),
  component: StationsPage,
  errorComponent: ({ error }) => (
    <Layout>
      <div className="p-12 text-center text-red-600">{error.message}</div>
    </Layout>
  ),
  notFoundComponent: () => (
    <Layout>
      <div className="p-12 text-center">Not found.</div>
    </Layout>
  ),
});

function StationsPage() {
  const { data: stations } = useSuspenseQuery(stationsQuery);
  return (
    <Layout>
      <PageHeader
        eyebrow="The Affiliate Network"
        title="Affiliate stations"
        description="Independent newsrooms powered by the WKNA-49 platform. Every station is owned and operated by its local team."
      />
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {stations.length} {stations.length === 1 ? "station" : "stations"} in the network
          </p>
          <Link
            to="/network"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Become an Affiliate Station →
          </Link>
        </div>

        {stations.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <h2 className="font-display text-2xl font-black text-primary">
              Be the first station in the network
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
              Affiliate stations get listed here so readers can find their local newsroom. Launch yours
              today and your station shows up the moment you opt in.
            </p>
            <Link
              to="/network"
              className="mt-6 inline-flex h-11 items-center rounded-md bg-[color:var(--breaking)] px-6 text-sm font-bold text-white"
            >
              Join the Affiliate Network
            </Link>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {stations.map((s, i) => (
              <StationCard key={`${s.website_url}-${i}`} station={s} />
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}

function StationCard({ station }: { station: PublicStation }) {
  const host = (() => {
    try {
      return new URL(station.website_url).host.replace(/^www\./, "");
    } catch {
      return station.website_url;
    }
  })();
  const location = [station.city, station.region].filter(Boolean).join(", ");
  return (
    <li className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        {station.logo_url ? (
          <img
            src={station.logo_url}
            alt={`${station.display_name} logo`}
            className="h-12 w-12 rounded-md object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-lg font-black text-primary-foreground">
            {station.display_name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-black text-primary">{station.display_name}</h3>
          {location && <p className="truncate text-xs text-muted-foreground">{location}</p>}
        </div>
      </div>
      {station.tagline && (
        <p className="mt-3 line-clamp-3 text-sm text-foreground/85">{station.tagline}</p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider ${
            station.kind === "managed"
              ? "bg-[color:var(--broadcast)]/10 text-[color:var(--broadcast)]"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {station.kind === "managed" ? "Managed mirror" : "Self-hosted"}
        </span>
        <a
          href={station.website_url}
          target="_blank"
          rel="noopener"
          className="truncate font-semibold text-primary hover:underline"
        >
          {host} →
        </a>
      </div>
    </li>
  );
}
