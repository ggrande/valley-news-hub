import { createFileRoute } from "@tanstack/react-router";
import { CmsPage } from "@/components/site/CmsPage";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — WKNA 49 News" },
      { name: "description", content: "How WKNA-TV 49 collects, uses, and protects information on WKNA49.com." },
      { property: "og:url", content: "/privacy-policy" },
    ],
    links: [{ rel: "canonical", href: "/privacy-policy" }],
  }),
  component: Page,
});

function Page() {
  return (
    <CmsPage contentKey="page_privacy_policy" eyebrow="Policies" defaultTitle="Privacy Policy">
      <p>This Privacy Policy describes how WKNA-TV 49 ("WKNA 49," "we," "our") collects and uses information when you visit WKNA49.com.</p>
      <h2 className="mt-8 font-display text-2xl font-bold text-primary">Information we collect</h2>
      <p className="mt-3">We collect information you provide directly — for example when you submit a news tip, sign up for our newsletter, or contact our sales team. We also collect basic technical information such as device type, browser, and pages visited to operate and improve the site.</p>
      <h2 className="mt-8 font-display text-2xl font-bold text-primary">How we use information</h2>
      <p className="mt-3">We use information to deliver our news coverage, respond to your messages, send our newsletter, and improve WKNA49.com. We do not sell personal information.</p>
      <h2 className="mt-8 font-display text-2xl font-bold text-primary">Cookies</h2>
      <p className="mt-3">WKNA49.com uses cookies and similar technologies to remember preferences and to measure site performance.</p>
      <h2 className="mt-8 font-display text-2xl font-bold text-primary">Contact</h2>
      <p className="mt-3">Questions about this policy can be sent to <a className="text-[color:var(--broadcast)] underline" href="mailto:news@wkna49.com">news@wkna49.com</a>.</p>
    </CmsPage>
  );
}
