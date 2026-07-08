import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";
import { FormBlock } from "@/components/site/Form";
import { submitNewsTip } from "@/lib/public-submissions.functions";

export const Route = createFileRoute("/submit-news-tip")({
  head: () => ({
    meta: [
      { title: "Submit a News Tip — WKNA 49 News" },
      { name: "description", content: "Send a news tip to the WKNA 49 newsroom in Charleston, West Virginia." },
      { property: "og:url", content: "/submit-news-tip" },
    ],
    links: [{ rel: "canonical", href: "/submit-news-tip" }],
  }),
  component: TipPage,
});

function TipPage() {
  return (
    <Layout>
      <PageHeader eyebrow="WKNA 49 Newsroom" title="Submit a News Tip" description="Have a story we should be covering? Share it with our reporters." />
      <section className="mx-auto max-w-3xl px-4 py-10">
        <FormBlock
          intro={
            <>
              The WKNA 49 newsroom reviews every tip. For time-sensitive tips, you can also email{" "}
              <a className="text-[color:var(--broadcast)] underline" href="mailto:tips@wkna49.com">tips@wkna49.com</a>.
            </>
          }
          successTitle="Thanks — we received your tip."
          successBody="A WKNA 49 News producer will review it and reach out if we need more information."
          submitLabel="Send News Tip"
          onSubmitValues={async (v) => {
            await submitNewsTip({ data: {
              name: v.name, email: v.email, location: v.location,
              category: v.topic, details: v.details,
            } });
          }}
          fields={[
            { name: "name", label: "Your Name" },
            { name: "email", label: "Email", type: "email" },
            { name: "location", label: "Location / Neighborhood" },
            { name: "topic", label: "Topic", type: "select", options: ["Local News", "Traffic", "Weather", "Community", "Sports", "Investigative", "Other"] },
            { name: "details", label: "Tip Details", type: "textarea", required: true, placeholder: "What's happening and how did you hear about it?" },
          ]}
        />
      </section>
    </Layout>
  );
}
