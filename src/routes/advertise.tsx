import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";
import { FormBlock } from "@/components/site/Form";
import { supabase } from "@/integrations/supabase/client";
import { Check } from "lucide-react";

export const Route = createFileRoute("/advertise")({
  head: () => ({
    meta: [
      { title: "Advertise on WKNA 49 News" },
      { name: "description", content: "Reach Charleston and the Kanawha Valley with broadcast and digital advertising on WKNA-TV 49." },
      { property: "og:url", content: "/advertise" },
    ],
    links: [{ rel: "canonical", href: "/advertise" }],
  }),
  component: Advertise,
});

function Advertise() {
  return (
    <Layout>
      <PageHeader eyebrow="Reach the Kanawha Valley" title="Advertise with WKNA-TV 49" description="Broadcast spots, digital placements, and sponsored newscasts across Charleston and the surrounding valley." />
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-black text-primary">Why WKNA 49</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                "Trusted local news brand serving Charleston since the 1950s.",
                "Multi-platform reach: broadcast, WKNA49.com, newsletter, and live stream.",
                "Sponsorship opportunities across newscasts, weather, and sports.",
                "Dedicated local sales team — no national-only ad sales.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 text-[color:var(--broadcast)]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-lg border bg-[color:var(--ivory)] p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--broadcast)]">Direct line</p>
              <p className="mt-1 font-display text-xl font-bold text-primary">advertising@wkna49.com</p>
              <p className="text-sm text-muted-foreground">304-555-0149 (ask for Sales)</p>
            </div>
          </div>
          <FormBlock
            intro="Tell us about your business and a representative will follow up with rates and availability."
            submitLabel="Request Information"
            successTitle="Thanks — we'll be in touch."
            onSubmitValues={async (v) => {
              const { error } = await supabase.from("ad_inquiries").insert({
                contact_name: v.name, company: v.company, email: v.email, phone: v.phone,
                budget_range: v.budget, details: v.message,
              });
              if (error) throw error;
            }}
            fields={[
              { name: "name", label: "Your Name", required: true },
              { name: "company", label: "Company", required: true },
              { name: "email", label: "Email", type: "email", required: true },
              { name: "phone", label: "Phone", type: "tel" },
              { name: "budget", label: "Estimated Budget", type: "select", options: ["Under $1,000", "$1,000–$5,000", "$5,000–$25,000", "$25,000+"] },
              { name: "message", label: "Tell us about your goals", type: "textarea", required: true },
            ]}
          />
        </div>
      </section>
    </Layout>
  );
}
