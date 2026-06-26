import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Layout, PageHeader } from "@/components/site/Layout";

type Release = {
  id: string;
  version: string;
  channel: string;
  title: string;
  changelog_md: string;
  breaking: boolean;
  security: boolean;
  published_at: string | null;
};

const listReleases = createServerFn({ method: "GET" }).handler(async (): Promise<Release[]> => {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await (supabase as any)
    .from("platform_releases")
    .select("id,version,channel,title,changelog_md,breaking,security,published_at")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Release[];
});

const releasesQuery = queryOptions({
  queryKey: ["platform_releases"],
  queryFn: () => listReleases(),
});

export const Route = createFileRoute("/network/changelog")({
  head: () => ({
    meta: [
      { title: "Changelog — WKNA-49 Network Platform" },
      { name: "description", content: "Every release of the WKNA-49 news platform, with notes and download links." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(releasesQuery),
  component: ChangelogPage,
  errorComponent: ({ error }) => <Layout><div className="p-12 text-center text-red-600">{error.message}</div></Layout>,
  notFoundComponent: () => <Layout><div className="p-12 text-center">Not found.</div></Layout>,
});

function ChangelogPage() {
  const { data: releases } = useSuspenseQuery(releasesQuery);
  return (
    <Layout>
      <PageHeader
        eyebrow="Platform updates"
        title="Changelog"
        description="Every release shipped to network members. Self-hosters can download from their admin dashboard; managed mirrors get an in-app accept/reject prompt."
      />
      <section className="mx-auto max-w-3xl px-4 py-12 space-y-8">
        {releases.length === 0 ? (
          <p className="text-muted-foreground">No releases published yet. Check back soon.</p>
        ) : (
          releases.map((r) => (
            <article key={r.id} className="rounded-xl border bg-card p-6">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="font-display text-2xl font-black text-primary">v{r.version}</h2>
                {r.channel !== "stable" && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{r.channel}</span>}
                {r.breaking && <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Breaking</span>}
                {r.security && <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">Security</span>}
                {r.published_at && (
                  <time className="ml-auto text-xs text-muted-foreground">{new Date(r.published_at).toLocaleDateString()}</time>
                )}
              </div>
              <h3 className="mt-1 text-lg font-semibold">{r.title}</h3>
              <pre className="mt-4 whitespace-pre-wrap font-news text-sm text-foreground">{r.changelog_md}</pre>
            </article>
          ))
        )}
      </section>
    </Layout>
  );
}
