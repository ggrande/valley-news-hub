
-- Affiliate directory + onboarding fields on managed_sites
ALTER TABLE public.managed_sites
  ADD COLUMN IF NOT EXISTS directory_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS directory_tagline TEXT,
  ADD COLUMN IF NOT EXISTS directory_city TEXT,
  ADD COLUMN IF NOT EXISTS directory_region TEXT,
  ADD COLUMN IF NOT EXISTS directory_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS directory_website_url TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Optional directory listing for self-hosters (no managed site row)
CREATE TABLE IF NOT EXISTS public.affiliate_directory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  tagline TEXT,
  city TEXT,
  region TEXT,
  logo_url TEXT,
  website_url TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_directory_entries TO authenticated;
GRANT ALL ON public.affiliate_directory_entries TO service_role;

ALTER TABLE public.affiliate_directory_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their own directory entries"
  ON public.affiliate_directory_entries FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Admins manage all directory entries"
  ON public.affiliate_directory_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service role full access directory entries"
  ON public.affiliate_directory_entries FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_affiliate_directory_entries_updated_at ON public.affiliate_directory_entries;
CREATE TRIGGER trg_affiliate_directory_entries_updated_at
  BEFORE UPDATE ON public.affiliate_directory_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public, read-only listing function. Bundles opted-in managed mirrors
-- + approved self-host entries. Returns only safe display fields.
CREATE OR REPLACE FUNCTION public.list_public_affiliate_stations()
RETURNS TABLE (
  kind TEXT,
  display_name TEXT,
  tagline TEXT,
  city TEXT,
  region TEXT,
  logo_url TEXT,
  website_url TEXT,
  since TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'managed'::TEXT AS kind,
    ms.display_name,
    ms.directory_tagline AS tagline,
    ms.directory_city AS city,
    ms.directory_region AS region,
    ms.directory_logo_url AS logo_url,
    COALESCE(
      NULLIF(ms.directory_website_url, ''),
      CASE WHEN ms.custom_domain IS NOT NULL AND ms.custom_domain <> ''
           THEN 'https://' || ms.custom_domain
           ELSE 'https://' || ms.subdomain || '.wkna49.com'
      END
    ) AS website_url,
    ms.created_at AS since
  FROM public.managed_sites ms
  WHERE ms.directory_opt_in = true
    AND ms.status = 'active'
  UNION ALL
  SELECT
    'self_host'::TEXT AS kind,
    ade.display_name,
    ade.tagline,
    ade.city,
    ade.region,
    ade.logo_url,
    ade.website_url,
    ade.created_at AS since
  FROM public.affiliate_directory_entries ade
  WHERE ade.approved = true
  ORDER BY since DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_public_affiliate_stations() TO anon, authenticated, service_role;
