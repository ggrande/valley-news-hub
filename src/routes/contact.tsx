import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";
import { FormBlock } from "@/components/site/Form";
import { supabase } from "@/integrations/supabase/client";
import { Mail, MapPin } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact WKNA 49 News" },
      { name: "description", content: "Contact the WKNA 49 newsroom, sales, weather and sports teams in Charleston, West Virginia." },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

const contacts = [
  ["Newsroom", "news@wkna49.com"],
  ["News Tips", "tips@wkna49.com"],
  ["Weather", "weather@wkna49.com"],
  ["Sports", "sports@wkna49.com"],
  ["Advertising", "advertising@wkna49.com"],
  ["Careers", "careers@wkna49.com"],
];

function ContactPage() {
  return (
    <Layout>
      <PageHeader eyebrow="Get in touch" title="Contact WKNA 49 News" description="Reach the right team at Charleston's Channel 49." />
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <FormBlock
            intro="Send a message to the WKNA 49 newsroom. For tips, please use our News Tip form so we can route it quickly."
            submitLabel="Send Message"
            onSubmitValues={async (v) => {
              const { error } = await supabase.from("contact_submissions").insert({
                name: v.name, email: v.email, subject: v.subject, message: v.message,
              });
              if (error) throw error;
            }}
            fields={[
              { name: "name", label: "Your Name", required: true },
              { name: "email", label: "Email", type: "email", required: true },
              { name: "subject", label: "Subject", required: true },
              { name: "message", label: "Message", type: "textarea", required: true },
            ]}
          />
          <aside className="space-y-5">
            <div className="rounded-lg border bg-card p-5">
              <h2 className="font-display text-lg font-bold text-primary">Station Information</h2>
              <p className="mt-3 flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 text-[color:var(--broadcast)]" />
                Charleston, West Virginia
              </p>
            </div>
            <div className="rounded-lg border bg-card p-5">
              <h2 className="font-display text-lg font-bold text-primary">Team Contacts</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {contacts.map(([t, e]) => (
                  <li key={e} className="flex items-center justify-between gap-3 border-b py-1.5 last:border-0">
                    <span className="font-semibold text-primary">{t}</span>
                    <a href={`mailto:${e}`} className="inline-flex items-center gap-1 text-[color:var(--broadcast)] hover:underline">
                      <Mail className="size-3.5" /> {e}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </Layout>
  );
}
