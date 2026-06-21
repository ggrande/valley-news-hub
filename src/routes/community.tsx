import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";
import { ArticleCard } from "@/components/site/ArticleCard";
import { FormBlock } from "@/components/site/Form";
import { articles } from "@/lib/news-data";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community — WKNA 49 News" },
      { name: "description", content: "Community calendar, events, and stories from across the Kanawha Valley." },
      { property: "og:url", content: "/community" },
    ],
    links: [{ rel: "canonical", href: "/community" }],
  }),
  component: CommunityPage,
});

const events = [
  { date: "Sat Jun 27", name: "Kanawha River Cleanup", location: "Magic Island, Charleston" },
  { date: "Sun Jun 28", name: "South Hills Farmers Market", location: "South Hills Community Center" },
  { date: "Thu Jul 2", name: "Downtown Summer Concert", location: "Haddad Riverfront Park" },
  { date: "Fri Jul 3", name: "Independence Eve Fireworks", location: "Charleston Civic Center" },
  { date: "Sat Jul 11", name: "Capitol Market Maker Fair", location: "Capitol Market" },
];

function CommunityPage() {
  const community = articles.filter((a) => ["Community", "Local", "Business"].includes(a.category));
  return (
    <Layout>
      <PageHeader eyebrow="Around the Valley" title="Community" description="Local events, volunteer opportunities, and the people that make the Kanawha Valley what it is." />
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            <h2 className="mb-5 border-b-2 border-primary pb-2 font-display text-2xl font-black text-primary">Community Stories</h2>
            <div className="news-grid">
              {community.map((a) => <ArticleCard key={a.slug} a={a} />)}
            </div>
          </div>
          <aside>
            <h2 className="mb-5 border-b-2 border-primary pb-2 font-display text-2xl font-black text-primary">Community Calendar</h2>
            <ul className="space-y-3">
              {events.map((e) => (
                <li key={e.name} className="rounded-md border bg-card p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--broadcast)]">{e.date}</p>
                  <p className="mt-1 font-display font-bold text-primary">{e.name}</p>
                  <p className="text-xs text-muted-foreground">{e.location}</p>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <div className="mt-14">
          <h2 className="mb-5 border-b-2 border-primary pb-2 font-display text-2xl font-black text-primary">Submit a Community Event</h2>
          <FormBlock
            intro="Share a public event you'd like the WKNA 49 newsroom to consider for our community calendar."
            successTitle="Event submitted — thanks!"
            successBody="Our community team reviews submissions before they're added to the calendar."
            submitLabel="Submit Event"
            onSubmitValues={async (v) => {
              const { error } = await supabase.from("community_events").insert({
                title: v.event, description: v.details, location: v.location,
                event_date: v.date || null, submitter_name: v.name, submitter_email: v.email,
              });
              if (error) throw error;
            }}
            fields={[
              { name: "name", label: "Your Name", required: true },
              { name: "email", label: "Email", type: "email", required: true },
              { name: "event", label: "Event Name", required: true },
              { name: "date", label: "Event Date", type: "date", required: true },
              { name: "location", label: "Location" },
              { name: "details", label: "Details", type: "textarea", required: true, placeholder: "Brief description of the event…" },
            ]}
          />
        </div>
      </section>
    </Layout>
  );
}
