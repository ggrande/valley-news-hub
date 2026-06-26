
# Current state vs. plan — Affiliate Network

## What's already shipped

- **Pricing & checkout** — `/network` with two tiers (Independent $49.99 one-time, Managed $9.99/mo), Stripe embedded checkout, billing portal.
- **Post-payment data** — webhook creates a `network_purchases` row, mints `licenses` for self-host, and inserts a `managed_sites` row with `status: pending_provision`.
- **Repositioned copy** — "Affiliate Station / Affiliate Network" throughout `/network`, `/network/docs`, `/network/changelog`.
- **Public directory** — `/network/stations` + `affiliate_directory_entries` table + `list_public_affiliate_stations()` RPC.
- **Onboarding wizard UI** — 4-step wizard at `/account/managed-sites/$siteId/onboarding` (Identity → Branding → Domain → Review).
- **My Stations dashboard** — `/account/managed-sites` with billing portal, release accept/reject, "Finish setup" CTA.
- **Release pipeline** — GitHub Action builds a scrubbed ZIP, ingest endpoint stores it, stations get update banners.

## What's missing (the actual gap)

The webhook only writes a DB row. Nothing actually **stands up an affiliate's site or admin**. There's no per-tenant scoping in this codebase (posts, site_content, authors are all global to WKNA-49), so a buyer cannot "land in their admin" inside this app. The wizard collects data that has no destination yet, and `/checkout/return` is a generic confirmation instead of dropping them into setup.

Also missing: admin moderation for self-host directory submissions, lifecycle emails, and any way to fully test the buyer journey today.

---

# The plan: hybrid instant-config + background dedicated deploy

The buyer experience:

```text
Stripe checkout (sandbox-testable)
        │
        ▼
Auto-redirect → /account/managed-sites/{id}/onboarding
        │  (collect name, branding, domain — exists already)
        ▼
"Provisioning your station…" status screen with live progress
        │  ┌─ create GitHub repo from template (workflow_dispatch)
        │  ├─ create Supabase project via Management API
        │  ├─ write env + secrets into the new repo
        │  ├─ trigger first deploy
        │  └─ seed site_content from wizard answers
        ▼
"Your station is live!" → button opens THEIR new admin URL in a new tab
```

The buyer never waits on a blank screen — they fill out the wizard while provisioning runs in parallel. If they finish faster than the deploy, we show the spinner; if the deploy finishes first, the wizard ends with a green "Open my admin" button.

## Build steps

### 1. Post-checkout redirect (small, ship first)
- Change `subscription_data.metadata` in `network-payments.functions.ts` so the webhook can resolve the new `managed_sites.id`.
- Update `return_url` for `tier=managed_mirror` to `/checkout/managed-onboarding-return?session_id={CHECKOUT_SESSION_ID}`.
- New route `checkout.managed-onboarding-return.tsx` that polls `network_purchases` by session id, finds the freshly-created `managed_sites` row, then `redirect()`s to `/account/managed-sites/{id}/onboarding`.

### 2. Provisioning state machine
Add columns to `managed_sites`:
- `provision_state` text (`queued`, `repo_created`, `db_created`, `deploying`, `ready`, `failed`)
- `provision_steps` jsonb (per-step status + timestamps for the progress UI)
- `github_repo` text, `supabase_project_ref` text, `live_url` text, `admin_url` text
- `provision_error` text

### 3. Provisioning workflow + dispatcher
- New `.github/workflows/provision-affiliate.yml` triggered by `workflow_dispatch` from the webhook. Inputs: `siteId`, `subdomain`, `displayName`, `ownerEmail`.
- Workflow steps:
  1. Create new GitHub repo from the WKNA-49 template (`gh repo create --template`)
  2. Create new Supabase project via Management API
  3. Run all migrations against the new project
  4. Write GitHub repo secrets (`SUPABASE_*`, `LOVABLE_API_KEY`, etc.) via `gh secret set`
  5. Trigger Lovable Cloud / Cloudflare Pages deploy (whichever platform we pick — see Open question below)
  6. Seed `site_content` rows from the wizard answers in our master DB
  7. POST back to `/api/public/hooks/provision-callback` with `live_url`, `admin_url`, success/failure, per-step trace
- Each step also pings the callback so the user sees live progress.

### 4. Status-aware onboarding wizard
- Add a **Step 0 "Provisioning"** that polls `getMyManagedSiteProfile` every 2s and shows a checklist:
  ```text
  ✓ Spinning up your repository
  ✓ Creating your database
  ◌ Deploying your site         (in progress)
  ◌ Activating your admin
  ```
- If provisioning finishes before the buyer reaches Step 4, the final button changes from "Finish setup" to **"Open my admin →"** linking to `admin_url`.
- If provisioning fails, surface the error with a "Retry" button that re-dispatches the workflow.

### 5. Admin moderation for self-host directory
- New `/admin/affiliate-directory` listing pending `affiliate_directory_entries` with approve/reject buttons (admins only via `has_role`).

### 6. Lifecycle emails (uses the existing email infra)
- **Welcome email** on `checkout.session.completed` — order summary + onboarding link.
- **Provisioning complete** email — live URL + admin URL + first-login instructions.
- **Onboarding nudge** — 24h after purchase if `onboarding_completed_at` is null.

### 7. Sandbox end-to-end test path
Once all of the above is in:
1. Use Stripe sandbox card `4242 4242 4242 4242` on `/network` → buy Managed tier
2. Get auto-redirected into the wizard
3. Watch the live provisioning checklist
4. Fill in branding while it runs
5. Hit "Open my admin" → land on the new station's admin URL, fully owned by the buyer
6. Publish a test article on the new station

We can run that whole flow in this environment without touching real money.

---

# Open question I need answered before building

**Which deployment platform should each affiliate's site land on?**
You mentioned earlier we'd discussed a specific platform, but I want to confirm before I wire the GitHub Action — the choice changes step 5 of the workflow and which API token I need stored:

- **Lovable Cloud** — closest to how WKNA-49 itself runs; needs a Lovable deploy API token.
- **Cloudflare Pages** — fast, free tier, simple `wrangler` deploy; needs `CLOUDFLARE_API_TOKEN` + account id.
- **Netlify** — matches the existing self-host one-click template; needs `NETLIFY_AUTH_TOKEN`.
- **Vercel** — needs `VERCEL_TOKEN` + team id.

Pick one and tell me; I'll request the secret via the add-secret flow and proceed.

---

# Technical notes (for reference)

- The `GH_DISPATCH_PAT` secret already exists; it needs `repo` + `workflow` + `admin:org` scopes to create repos from a template.
- Supabase Management API token (`SUPABASE_ACCESS_TOKEN`) is required for the per-tenant DB creation — not currently stored; I will request it.
- Per-tenant admin auth: the new project gets its own Supabase auth; the buyer's email is auto-invited as the admin user during step 1 via Supabase Admin API on the new project.
- Webhook idempotency: provisioning is keyed on `managed_sites.id`; the callback uses `provision_state` transitions to ignore replays.
- All new tables / column additions ship as one Supabase migration with proper GRANTs + RLS scoped to `owner_user_id` and `has_role('admin')`.
- No changes to the existing WKNA-49 admin tenancy — the master site stays single-tenant; each affiliate runs in its own isolated project.

