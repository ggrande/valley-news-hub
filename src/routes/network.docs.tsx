import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/site/Layout";

export const Route = createFileRoute("/network/docs")({
  head: () => ({
    meta: [
      { title: "Self-Host Setup Guide — WKNA-49 Network" },
      { name: "description", content: "Step-by-step setup for self-hosting the WKNA-49 newsroom platform: Lovable Cloud, AI Gateway, deployment, and update flow." },
    ],
  }),
  component: DocsPage,
  errorComponent: ({ error }) => <Layout><div className="p-12 text-center text-red-600">{error.message}</div></Layout>,
  notFoundComponent: () => <Layout><div className="p-12 text-center">Not found.</div></Layout>,
});

function Code({ children }: { children: React.ReactNode }) {
  return <pre className="overflow-x-auto rounded-md bg-[color:var(--navy-dark)] p-4 text-xs text-white/90"><code>{children}</code></pre>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-lg font-black text-primary-foreground">{n}</span>
        <h2 className="font-display text-xl font-bold text-primary">{title}</h2>
      </div>
      <div className="mt-4 space-y-3 text-sm text-foreground/85">{children}</div>
    </div>
  );
}

function DocsPage() {
  return (
    <Layout>
      <PageHeader
        eyebrow="Self-Host Docs"
        title="Set up your own WKNA-49 style newsroom"
        description="A 20-minute walkthrough for self-hosters. If you'd rather we run it for you, grab a Managed Mirror on the /network page."
      />
      <section className="mx-auto max-w-3xl px-4 py-10 space-y-6">
        <Step n={1} title="Download your release">
          <p>After purchase, head to <Link to="/account/licenses" className="text-primary underline">your license dashboard</Link>. Download the latest scrubbed ZIP — it contains the full source minus our private credentials and operational data.</p>
          <p>Unzip it into a new folder and open it in your editor of choice.</p>
        </Step>

        <Step n={2} title="Provision Lovable Cloud (or Supabase)">
          <p>The platform expects a Postgres backend with the Supabase Data API. You have two paths:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Easiest:</strong> open the project in Lovable and enable Lovable Cloud — it provisions everything automatically.</li>
            <li><strong>Manual:</strong> create a Supabase project, then run every migration under <code>supabase/migrations/</code> in chronological order.</li>
          </ul>
        </Step>

        <Step n={3} title="Configure environment">
          <p>Copy <code>.env.development</code> to <code>.env</code> and fill in:</p>
          <Code>{`VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server only
LOVABLE_API_KEY=...              # for AI Gateway
APP_BASE_URL=https://yoursite.com
CRON_SECRET=<long random string>

# Required so update banners can find the network host
VITE_NETWORK_LICENSE_KEY=<key from your /account/licenses>
VITE_PLATFORM_VERSION=1.0.0
VITE_NETWORK_UPDATE_HOST=https://wkna49.com`}</Code>
        </Step>

        <Step n={4} title="Customize your station">
          <p>All branding, policies, social links, and support buttons are stored in the <code>site_content</code> table — no code changes needed.</p>
          <p>Sign in as the first admin user (the bootstrap trigger promotes the first signup), then visit <code>/admin/site-content</code> to rename the station, change colors, replace logos, and rewrite policy pages.</p>
        </Step>

        <Step n={5} title="Deploy">
          <p>The project is a TanStack Start app and ships with a Cloudflare/Netlify-compatible build. Run:</p>
          <Code>{`bun install
bun run build
bun run start`}</Code>
          <p>For Netlify, connect the repo and the included build settings will be picked up automatically. For Vercel/Cloudflare, set the build command to <code>bun run build</code> and the output directory to <code>.output</code>.</p>
        </Step>

        <Step n={6} title="Stay current with updates">
          <p>On every page load, your install pings the network host using your license key. When a new release is published you'll see an in-app banner — security releases are flagged red, breaking changes amber. Download from <Link to="/account/licenses" className="text-primary underline">your license dashboard</Link>, unzip over your project, and redeploy.</p>
          <p>Need a managed experience? Switch to a <Link to="/network" className="text-primary underline">Managed Mirror</Link> anytime — we'll host, update, and back it all up for you.</p>
        </Step>

        <div className="rounded-xl border-2 border-[color:var(--breaking)] bg-card p-6">
          <h2 className="font-display text-xl font-bold text-primary">Need help?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Email <a href="mailto:network@wkna49.com" className="text-primary underline">network@wkna49.com</a> with your license key and we'll help you get unstuck.</p>
        </div>
      </section>
    </Layout>
  );
}
