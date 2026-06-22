
-- 1) Authors: remove email from anon's column-level SELECT grant.
REVOKE SELECT ON public.authors FROM anon;
GRANT SELECT (id, slug, name, title, bio, avatar_url, is_active, created_at) ON public.authors TO anon;
-- authenticated keeps full access via existing grants; admins use is_admin() policy for writes.

-- 2) Site settings: replace permissive public read with an allowlist of safe keys.
DROP POLICY IF EXISTS "settings public read" ON public.site_settings;

CREATE POLICY "settings public read safe keys"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (key IN ('allow_public_comments', 'show_imported_discussion'));

CREATE POLICY "settings admin read all"
ON public.site_settings
FOR SELECT
TO authenticated
USING (public.is_admin());
