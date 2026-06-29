# Path-based tenants + Network feed sync

Two changes, shipped together.

## 1. Tenant URL: `network.wkna49.com/{slug}`

Replace subdomain routing with a path-prefix model. `{slug}.wkna49.com` lookups are removed from the resolver; the wildcard `*` DNS record is no longer load-bearing for tenants (safe to leave).

### Routing

- New pathless layout `src/routes/network_.$siteSlug.tsx`:
  - `beforeLoad`: resolves slug → tenant via `getTenantBySlug` server fn; throws `notFound()` if missing.
  - Puts tenant branding into route context (`siteId`, `displayName`, `logoUrl`, ...).
  - Renders `<Outlet />`.
- New leaves under that layout for every public tenant page:
  - `network_.$siteSlug.index.tsx` → homepage (mirrors `routes/index.tsx`)
  - `network_.$siteSlug.news.index.tsx`, `news.$slug.tsx`, `weather.tsx`, `about.tsx`, `contact.tsx`, `merch.index.tsx`, etc. Each reuses the existing page component, parameterized by the tenant from route context.
  - `network_.$siteSlug.admin.tsx` redirects to `/station/admin?site={slug}` for the magic-link login flow.

Underscore-suffixed segment (`network_`) keeps it from nesting under the existing `/network` marketing route.

### Tenant resolver

- `src/lib/tenant-resolver.functions.ts`:
  - Add `getTenantBySlug({ slug })` — looks up `managed_sites` by `subdomain` column (we keep the column; it's now the URL slug).
  - `getTenantByHost` stays but only returns a tenant for **custom domains**, not for `*.wkna49.com` subdomains.
- `src/lib/use-tenant.ts`: accept an explicit `siteSlug` from route params; fall back to host lookup for custom domains.

### Header / Logo / chrome

- `src/components/site/Layout.tsx`, `Header.tsx`, `Footer.tsx`, `Logo.tsx`: when a tenant context is active, all internal `<Link>`s are prefixed with `/network/{siteSlug}` via a small helper `useTenantHref(to)`. Master site links stay unprefixed.

### Subdomain redirect

- `src/routes/__root.tsx`: existing `*.wkna49.com` → `/admin` redirect becomes a one-time client redirect of `{slug}.wkna49.com/*` → `network.wkna49.com/{slug}/*` for back-compat with any links already shared. Custom domains are untouched.

## 2. Network feed sync (master → tenant, mixed feed)

Tenants display master WKNA49 posts blended with their own, by `published_at desc`. Each tenant can hide individual network posts and toggle the whole sync off.

### Data

Migration:

```sql
ALTER TABLE public.managed_sites
  ADD COLUMN network_sync_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE public.tenant_hidden_network_posts (
  site_id uuid NOT NULL REFERENCES public.managed_sites(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  hidden_by uuid,
  PRIMARY KEY (site_id, post_id)
);

GRANT SELECT, INSERT, DELETE ON public.tenant_hidden_network_posts TO authenticated;
GRANT ALL ON public.tenant_hidden_network_posts TO service_role;
ALTER TABLE public.tenant_hidden_network_posts ENABLE ROW LEVEL SECURITY;

-- Policy: tenant admins (matched via tenant_admin_sessions) manage their own rows.
CREATE POLICY "tenant admins manage hides" ON public.tenant_hidden_network_posts
  FOR ALL TO authenticated
  USING (public.is_admin())   -- master admins can see all
  WITH CHECK (public.is_admin());
-- Tenant magic-link sessions go through server fns w/ service role.
```

(Tenant-side writes happen via server functions authorized by `tenant_admin_sessions`, not direct RLS — same pattern already used for managed-site admin actions.)

### Feed query

- New `src/lib/network-feed.functions.ts`:
  - `getTenantFeed({ siteSlug, limit, categorySlug? })`: returns master posts (status='published', `network_syndicate=true` — default `true` for now) minus rows in `tenant_hidden_network_posts`, plus tenant-owned posts (future), unioned and sorted by `published_at desc`. Each item is tagged `source: 'network' | 'local'` so the UI can show a small "Network" chip.
  - Honors `managed_sites.network_sync_enabled`; when false, returns only local posts.
- `network_.$siteSlug.index.tsx` and `news.index.tsx` call this instead of `fetchPublishedPosts`.

### Tenant admin controls

In `/station/admin`:
- **Settings → Network sync** toggle that flips `network_sync_enabled`.
- **Network posts** list: paginated view of master posts with a per-row **Hide on my site** button → inserts/deletes a `tenant_hidden_network_posts` row via `hideNetworkPost` / `unhideNetworkPost` server fns (authorized by `tenant_admin_sessions`).

### Article page

- `network_.$siteSlug.news.$slug.tsx`: loads the master post; if it's hidden for this tenant, return `notFound()`. Local posts (future) resolve the same way.

## Out of scope (call out)

- Tenant-authored posts. The "local" half of the mixed feed is wired but empty until tenants can author. Happy to follow up with a tenant CMS pass.
- Removing the `*` wildcard A record. Harmless to leave; can be cleaned up later.
- Per-post categorization overrides per-tenant.

## Verification

1. `network.wkna49.com/fresh-station-dbb835` renders the mixed feed with the tenant's branding.
2. Hiding a post from the tenant admin removes it from that tenant only; master site unaffected.
3. Toggling sync off hides all network posts on that tenant.
4. `fresh-station-dbb835.wkna49.com/anything` redirects to `network.wkna49.com/fresh-station-dbb835/anything`.
