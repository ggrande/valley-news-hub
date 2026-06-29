## Goal
Walk a single brand-new "managed_mirror" purchase all the way through, from Stripe checkout to a working `{site}.wkna49.com` newsroom with a magic-link admin login. Fix every break we hit; no new features.

## Test scenario
A new Stripe test purchase (managed_mirror tier) → wizard runs to completion → tenant subdomain serves a branded public newsroom reading from `site_content` → tenant owner receives + uses a magic-link to access `/station/admin`.

## Verification checklist (in order)

1. **Purchase → DB row**
   - Run a sandbox Stripe checkout for managed_mirror.
   - Confirm webhook created `network_purchases` + `managed_sites` rows with `status='pending_provision'` and a unique `subdomain`.
   - Confirm post-checkout return URL lands on the onboarding wizard, not the merch/network success page.

2. **Wizard Step 0 — Project**
   - Supabase OAuth handshake completes; orgs + regions list.
   - "(default)" org auto-selects.
   - Project creation succeeds (random-suffix retry path tested by forcing a name collision once).
   - `tenant_provision_attempts` records the attempt with the full project name.

3. **Wizard Steps 1–4 — Brand / Directory / Domain / Finish**
   - `site_content` rows written for the new tenant (name, tagline, logo, colors).
   - `directory_opt_in` and directory fields persist.
   - Domain step accepts skip ("use {site}.wkna49.com").
   - "Open newsroom" button targets `https://{subdomain}.wkna49.com` (not `/account/managed-sites`).

4. **Tenant subdomain renders branded newsroom** ← biggest unknown
   - Visit `https://{subdomain}.wkna49.com/` in a real browser.
   - Confirm DNS resolves (wildcard `*.wkna49.com` at Porkbun + host cert).
   - Confirm `__root.tsx` subdomain detection loads the tenant's `site_content` instead of WKNA49 defaults.
   - Confirm Header/Footer/Logo show tenant brand.
   - Confirm `/news` and an article page render (even if empty) without 500s.
   - If DNS/cert is missing, document the exact records the user must add and stop here for that subtask.

5. **Tenant admin magic-link login**
   - Visit `https://{subdomain}.wkna49.com/admin` → redirects to `/station/admin` with subdomain context.
   - Submit owner email; confirm `tenant_admin_login_tokens` row and email delivered.
   - Visit `/station/verify?token=…` → `tenant_admin_sessions` row created → lands in tenant admin.
   - Confirm the session is scoped to that tenant only.

6. **Reset/recovery still works after a real run**
   - From `/account/managed-sites`, hit "Full reset" on the test site.
   - Confirm the orphan Supabase project is purged and local rows return to `pending_provision`.

## Deliverables
- A live test purchase walked through end-to-end with screenshots/links per step.
- A short status table: each checklist item → ✅ / ❌ / ⚠ (with exact failure).
- Patches for any failures discovered along the way, applied in the same iteration. No scope creep into custom-domain verification, in-tenant billing, or revenue share — those stay in the gap list for a follow-up plan.

## Technical notes
- Use Stripe **sandbox** webhook env so we don't bill real money.
- Drive the browser via Playwright in the sandbox for the subdomain + magic-link checks; restore the managed Supabase session for the wizard steps that require auth.
- Magic-link email: if SMTP isn't configured for the test, read the token directly from `tenant_admin_login_tokens` and hit `/station/verify` manually — note this in the report so we don't ship without verifying delivery.
- DNS wildcard: if `*.wkna49.com` isn't pointed at Lovable's host, the subdomain step will fail. That's a config task for the user at Porkbun + the publish settings, not a code change — surface it clearly rather than trying to "fix" it in code.
