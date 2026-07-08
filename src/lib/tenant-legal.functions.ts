// Public per-tenant legal pages (Terms / Privacy / DMCA).
// Stored as optional markdown columns on managed_sites; when a tenant
// hasn't written their own copy yet, we render a boilerplate template
// with the station name filled in.
import { createServerFn } from "@tanstack/react-start";

export type LegalKind = "terms" | "privacy" | "dmca";

const KIND_TO_COLUMN: Record<LegalKind, string> = {
  terms: "legal_terms_md",
  privacy: "legal_privacy_md",
  dmca: "legal_dmca_md",
};

const KIND_TO_TITLE: Record<LegalKind, string> = {
  terms: "Terms of Use",
  privacy: "Privacy Policy",
  dmca: "DMCA / Copyright",
};

export function boilerplate(kind: LegalKind, siteName: string): string {
  const name = siteName || "This station";
  const today = new Date().toISOString().slice(0, 10);
  if (kind === "terms") {
    return `## Terms of Use

_Last updated: ${today}_

Welcome to ${name}. By accessing this website you agree to these terms.
${name} is an independently operated affiliate of the WKNA 49 news network.

## Use of the site

You may read, share, and link to our reporting for personal, non-commercial use.
Republication of full articles requires written permission from ${name}.

## User submissions

Comments, tips, and community posts you submit remain your property, but you
grant ${name} a non-exclusive license to publish, edit, and moderate them.
We may remove any content at our sole discretion.

## Disclaimers

Content is provided "as is" without warranties of any kind. ${name} is not
liable for decisions made based on information published here.

## Changes

We may update these terms from time to time. Continued use of the site after
changes constitutes acceptance of the revised terms.

## Contact

Questions about these terms? Reach us via the [contact page](../contact).`;
  }
  if (kind === "privacy") {
    return `## Privacy Policy

_Last updated: ${today}_

${name} respects your privacy. This page explains what we collect and why.

## Information we collect

- **Contact info you provide**, such as your email when you subscribe to our newsletter or submit a news tip.
- **Basic analytics**, including anonymized page views and referrer data used to improve our reporting.
- **Comment metadata** if you post a comment, including the display name you enter.

## How we use it

We use this information only to operate the site: to deliver newsletters you asked for,
follow up on tips, moderate comments, and understand which stories our community reads.
We do not sell your personal information.

## Cookies

We use small first-party cookies to remember your preferences and to keep you signed
in when you comment. You can clear these at any time through your browser settings.

## Your rights

You may unsubscribe from our newsletter at any time using the link in every email.
To request deletion of personal data, contact us via the [contact page](../contact).

## Third parties

Some pages embed content from third parties (video players, weather providers).
Those services have their own privacy policies.`;
  }
  return `## DMCA / Copyright

_Last updated: ${today}_

${name} respects the intellectual property rights of others and expects users
of this site to do the same. If you believe content on this site infringes
your copyright, please send a written notice to our designated agent that
includes all of the following:

1. Your physical or electronic signature.
2. Identification of the copyrighted work you claim is infringed.
3. The URL of the material you claim is infringing.
4. Your contact information (address, phone, email).
5. A statement, made under penalty of perjury, that you have a good-faith
   belief that the use is not authorized by the copyright owner, its agent,
   or the law.
6. A statement that the information in the notice is accurate.

Send notices via our [contact page](../contact). We will respond to properly
submitted notices in accordance with the Digital Millennium Copyright Act.

## Counter-notice

If you believe your content was removed in error, you may submit a
counter-notice with the same information listed above and a statement that
you consent to jurisdiction of the federal court in the district where your
address is located.`;
}

export const getTenantLegalPage = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; kind: LegalKind }) => d)
  .handler(async ({ data }) => {
    const kind = data.kind;
    if (!KIND_TO_COLUMN[kind]) throw new Error("Invalid legal kind");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("managed_sites")
      .select(`id, display_name, subdomain, status, ${KIND_TO_COLUMN[kind]}`)
      .eq("subdomain", data.slug)
      .maybeSingle();
    if (!row || row.status === "suspended") return null;
    const stored = row[KIND_TO_COLUMN[kind]] as string | null;
    const body = stored && stored.trim().length > 0
      ? stored
      : boilerplate(kind, row.display_name);
    return {
      title: KIND_TO_TITLE[kind],
      siteName: row.display_name as string,
      body,
      isCustom: !!(stored && stored.trim().length > 0),
    };
  });
