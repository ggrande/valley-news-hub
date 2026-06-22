REVOKE SELECT ON public.authors FROM anon, authenticated;
GRANT SELECT (id, slug, name, title, bio, avatar_url, is_active, created_at) ON public.authors TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.authors TO authenticated;
GRANT ALL ON public.authors TO service_role;