# Join Our Network — Revised Plan

## Verdict
Feasible. Adds three new pillars on top of the prior plan: **release/update distribution**, **changelog**, and **editable site content**.

Tier pricing unchanged:
- **Self-host license** — $49.99 one-time, buyer hosts on their own Netlify.
- **Managed mirror** — $9.99/mo, runs on our shared multi-tenant backend at `<slug>.wkna49.com` (or custom domain).

Tension flagged previously still applies: managed mirror = we hold their data. If you want zero data custody for that tier too, say so and I'll redesign as "auto-deploy to their Netlify" instead.

---

## NEW: Releases, updates, and changelog

### Release model
Every meaningful change to *our* codebase becomes a versioned release. Mechanism:
- GitHub Action on `main` runs `scripts/build-template.ts` → produces a scrubbed ZIP + computes semver bump from commit messages (conventional commits) → uploads ZIP to `network-releases` storage bucket → inserts a row into `platform_releases` (`version, channel, changelog_md, zip_path, sha256, published_at, breaking`).
- `channel` = `stable` | `beta`. Default subscribers/licensees are on `stable`.

### Changelog
- Public route `/network/changelog` reads `platform_releases` and renders Markdown. Each entry: version, date, summary, full notes, breaking-change badge.
- Same data powers the in-app update banners below.

### Self-host buyers (license tier)
- License row tracks `current_version` (last version they downloaded).
- A small `/api/public/network/check-update?license=<key>&v=<current>` endpoint returns `{ latest, breaking, changelog_url, download_url }`. Token expires per request.
- The shipped template includes a tiny `useUpdateCheck()` hook that pings this endpoint daily from their `/admin` dashboard and renders an **"Update available: vX.Y.Z"** banner with link to changelog + one-click signed download URL.
- They re-deploy themselves (we never push code to their host). Banner has "Remind me later" / "Skip this version".
- Anyone can also browse `/network/releases` while signed in with their license key to grab the latest.

### Managed mirror tenants
- Tenants stay on the version their `sites` row pins (`sites.platform_version`). The shared backend is always on `latest` (since it's one codebase), so "updates" here mean **content/feature flags and schema-additive changes**, not literal redeploys per tenant.
- For breaking UX or new opt-in features, ship them behind a `feature_flags jsonb` column on `sites` defaulting to off. New release notes that affect tenants get surfaced in their admin as an **"New in vX.Y.Z — Enable?"** card. They click Accept (flag flips on) or Reject (flag stays off). Logged in `site_feature_decisions`.
- Pure schema/code changes that don't change tenant-visible behavior are auto-applied (no prompt) but still listed in their changelog feed.
- Super-admin can mark a release as `auto_enable: true` for non-optional changes.

### How a change flows end-to-end
1. We merge a PR → GH Action publishes release `v1.4.0` with changelog.
2. `platform_releases` row inserted, ZIP uploaded.
3. Self-hosters: see banner in their admin within 24h, download + redeploy on their own schedule.
4. Managed tenants: see "What's new in v1.4.0" card in their admin; accept/reject per flagged feature; non-flagged changes are already live (shared backend).

---

## NEW: Editable site content (per-tenant CMS)

Everything currently hardcoded becomes per-site data. Add a `site_content` table (`site_id, key, value jsonb, updated_at`) and an `/admin/site-content` page that edits it. Keys to migrate out of code:

**Identity & branding** — name, tagline, logo_url, favicon_url, primary_color, secondary_color, accent_color, og_default_image.

**Pages** — `about`, `careers`, `accessibility`, `corrections_policy`, `privacy_policy`, `terms_of_use`, `contact_intro`, `advertise_intro`, `submit_news_tip_intro`, `community_intro`, `weather_intro`. Each is `{ title, meta_description, body_md, hero_image }`.

**Contact & legal** — business_address, phone, news_tip_email, ads_email, careers_email, legal_entity_name, ein (optional), social_links `{twitter, facebook, instagram, youtube, tiktok}`.

**Support / monetization** — `bmc_username`, `crypto_wallets[]` (currently hardcoded in `SupportButton.tsx`), donation_enabled bool, ad_inquiry_form_enabled bool.

**Header/footer** — nav_items[], footer_columns[], alert_bar_text, alert_bar_enabled, live_player_url, live_player_enabled.

**Weather** — weather_location (lat/lng/label), closings_enabled.

**Newsroom defaults** — default_author_name, default_category, ai_*_prompt overrides (already in `site_settings` — fold those in).

Refactor every component that hardcodes copy (Footer, Header, About, SupportButton, contact pages, etc.) to read from `useSiteContent(key, fallback)` — a hook that pulls from a single per-request `site_content` fetch cached on the router context.

Admin UI: a single `/admin/site-content` page grouped into accordions (Branding, Pages, Contact, Footer, Support, Weather, Advanced). Markdown editor for body fields, color pickers for colors, image picker hooked to existing media bucket.

---

## Updated phased roadmap

**Phase 0 — Storefront + Stripe (small)**
- Enable Stripe payments, create the two products.
- `/network` marketing page, `/network/changelog` (empty until Phase 1 releases start).
- Stripe webhook `/api/public/hooks/stripe` records purchases in `network_purchases`.
- Tables: `platform_releases`, `licenses`, `network_purchases`.

**Phase 1 — Editable site content (refactor existing single site)**
- Migration: `site_content` table + seed with current hardcoded values.
- New `/admin/site-content` page.
- Refactor Header/Footer/About/SupportButton/contact pages/etc. to read from `site_content`.
- This phase delivers value to *you* immediately even before multi-tenancy.

**Phase 2 — Release pipeline + changelog**
- `scripts/build-template.ts` scrubber (strips secrets, Reddit automation creds, our content data).
- GH Action: on push to `main`, build ZIP, upload to `network-releases` bucket, insert `platform_releases`.
- `/network/changelog` public page.
- `/api/public/network/check-update` endpoint + signed download URL flow.
- Self-host download delivery: Stripe webhook → email license + first download link via Resend.

**Phase 3 — Multi-tenant managed mirror**
- Migration: add `site_id` to all content tables, backfill with seed site, rewrite RLS with `site_members`.
- Hostname → site resolver in `__root.tsx`; wildcard DNS for `*.wkna49.com`.
- Onboarding wizard at `/onboarding?site=<slug>`.
- Subscription lifecycle webhooks: provision/suspend.
- `feature_flags` on `sites` + `site_feature_decisions` table.
- Per-tenant "What's new" card on admin dashboard reading `platform_releases` since `sites.last_seen_release`.

**Phase 4 — Polish**
- Custom domain attach.
- Super-admin `/admin/network` dashboard (all tenants, all licenses, MRR).
- White-label transactional email via Resend per tenant.
- Beta channel for early-access tenants.

---

## Risks
- **Refactor scope (Phase 1)** is wider than it looks — every page that currently says "WKNA 49" or contains policy copy needs touching. Worth doing before Phase 3 so multi-tenancy gets it for free.
- **Self-host updates require buyer action** — banner is best-effort; some sites will run stale versions forever. The `/check-update` endpoint should also flag *known security releases* so the banner can escalate ("Security update — recommended").
- **Managed-tenant accept/reject** only works for behavior changes gated behind flags. Schema-breaking changes can't be opted out of — be disciplined about additive migrations.
- **Scrubbing the ZIP** must be a tested, automated process. One leaked `.env` or stale secret in a release is a real incident.

Approve and I'll start with Phase 0 (storefront + Stripe + release/license/changelog tables).