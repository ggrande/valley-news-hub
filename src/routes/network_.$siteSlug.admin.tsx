import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/network_/$siteSlug/admin")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/station/admin", search: { site: params.siteSlug } as any });
  },
  component: () => null,
});
