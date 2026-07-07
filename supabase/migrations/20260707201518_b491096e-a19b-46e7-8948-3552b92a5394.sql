CREATE OR REPLACE FUNCTION public.list_public_affiliate_stations()
 RETURNS TABLE(kind text, display_name text, tagline text, city text, region text, logo_url text, website_url text, since timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    'managed'::TEXT AS kind,
    ms.display_name,
    ms.directory_tagline AS tagline,
    ms.directory_city AS city,
    ms.directory_region AS region,
    ms.directory_logo_url AS logo_url,
    COALESCE(
      NULLIF(ms.directory_website_url, ''),
      CASE WHEN ms.custom_domain IS NOT NULL
                AND ms.custom_domain <> ''
                AND ms.custom_domain_status = 'verified'
           THEN 'https://' || ms.custom_domain
           ELSE 'https://' || ms.subdomain || '.wkna49.com'
      END
    ) AS website_url,
    ms.created_at AS since
  FROM public.managed_sites ms
  WHERE ms.directory_opt_in = true
    AND ms.status = 'active'
    AND ms.onboarding_completed_at IS NOT NULL
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
$function$;