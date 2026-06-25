-- Per-tenant / per-site editable content store
CREATE TABLE public.site_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_content TO anon;
GRANT SELECT ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read site content"
  ON public.site_content FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage site content"
  ON public.site_content FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER site_content_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default branding & contact values for WKNA 49
INSERT INTO public.site_content (key, value) VALUES
  ('branding', '{"name":"WKNA 49 News","tagline":"Charleston & the Kanawha Valley","primary_color":"#0a2540","accent_color":"#c8102e","logo_url":"/logo-rect.png","favicon_url":"/logo-round.png","square_logo_url":"/logo.png"}'::jsonb),
  ('contact', '{"business_address":"Charleston, WV","phone":"","news_tip_email":"tips@wkna49.com","ads_email":"ads@wkna49.com","careers_email":"careers@wkna49.com","legal_entity_name":"WKNA 49 News"}'::jsonb),
  ('social_links', '{"twitter":"","facebook":"","instagram":"","youtube":"","tiktok":""}'::jsonb),
  ('support', '{"bmc_username":"wknatv","crypto_wallets":[],"donation_enabled":true}'::jsonb),
  ('alert_bar', '{"enabled":false,"text":""}'::jsonb),
  ('live_player', '{"enabled":false,"url":""}'::jsonb),
  ('page_about', '{"title":"About WKNA 49","meta_description":"About WKNA 49 News.","body_md":""}'::jsonb),
  ('page_privacy_policy', '{"title":"Privacy Policy","meta_description":"Privacy policy.","body_md":""}'::jsonb),
  ('page_terms_of_use', '{"title":"Terms of Use","meta_description":"Terms of use.","body_md":""}'::jsonb),
  ('page_accessibility', '{"title":"Accessibility","meta_description":"Accessibility statement.","body_md":""}'::jsonb),
  ('page_corrections_policy', '{"title":"Corrections Policy","meta_description":"Corrections policy.","body_md":""}'::jsonb),
  ('page_careers', '{"title":"Careers","meta_description":"Join the WKNA 49 team.","body_md":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;
