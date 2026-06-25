
-- Platform releases (changelog + downloadable bundles)
CREATE TABLE public.platform_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  channel text NOT NULL DEFAULT 'stable' CHECK (channel IN ('stable','beta')),
  title text NOT NULL,
  changelog_md text NOT NULL DEFAULT '',
  breaking boolean NOT NULL DEFAULT false,
  security boolean NOT NULL DEFAULT false,
  zip_path text,
  zip_sha256 text,
  zip_bytes bigint,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_platform_releases_published_at ON public.platform_releases(published_at DESC);

GRANT SELECT ON public.platform_releases TO anon, authenticated;
GRANT ALL ON public.platform_releases TO service_role;
ALTER TABLE public.platform_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published releases" ON public.platform_releases
  FOR SELECT USING (published_at IS NOT NULL);
CREATE POLICY "Admins can manage releases" ON public.platform_releases
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER platform_releases_updated_at BEFORE UPDATE ON public.platform_releases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Network purchases (Stripe checkout completions, both tiers)
CREATE TABLE public.network_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tier text NOT NULL CHECK (tier IN ('self_host_license','managed_mirror')),
  email text NOT NULL,
  stripe_customer_id text,
  stripe_session_id text UNIQUE,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'pending',
  environment text NOT NULL DEFAULT 'sandbox',
  amount_cents integer,
  currency text DEFAULT 'usd',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_network_purchases_user ON public.network_purchases(user_id);
CREATE INDEX idx_network_purchases_email ON public.network_purchases(email);

GRANT SELECT ON public.network_purchases TO authenticated;
GRANT ALL ON public.network_purchases TO service_role;
ALTER TABLE public.network_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer can view own purchases" ON public.network_purchases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all purchases" ON public.network_purchases
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TRIGGER network_purchases_updated_at BEFORE UPDATE ON public.network_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Self-host licenses (one row per purchased license key)
CREATE TABLE public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid REFERENCES public.network_purchases(id) ON DELETE SET NULL,
  license_key text NOT NULL UNIQUE,
  email text NOT NULL,
  channel text NOT NULL DEFAULT 'stable' CHECK (channel IN ('stable','beta')),
  current_version text,
  last_check_at timestamptz,
  downloads_used integer NOT NULL DEFAULT 0,
  downloads_max integer NOT NULL DEFAULT 25,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_licenses_email ON public.licenses(email);
CREATE INDEX idx_licenses_key ON public.licenses(license_key);

GRANT SELECT ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage licenses" ON public.licenses
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TRIGGER licenses_updated_at BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Download tokens (signed, short-lived, single-use)
CREATE TABLE public.license_download_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  release_id uuid REFERENCES public.platform_releases(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dl_tokens_license ON public.license_download_tokens(license_id);

GRANT ALL ON public.license_download_tokens TO service_role;
ALTER TABLE public.license_download_tokens ENABLE ROW LEVEL SECURITY;
-- service_role only — no policies for anon/authenticated
