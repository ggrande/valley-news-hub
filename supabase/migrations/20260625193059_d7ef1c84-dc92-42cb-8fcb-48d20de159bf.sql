
-- Managed mirror sites: one row per tenant on the $9.99/mo plan
CREATE TABLE public.managed_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_email text NOT NULL,
  purchase_id uuid REFERENCES public.network_purchases(id) ON DELETE SET NULL,
  stripe_subscription_id text UNIQUE,
  subdomain text NOT NULL UNIQUE,
  custom_domain text UNIQUE,
  display_name text NOT NULL DEFAULT 'My News Site',
  status text NOT NULL DEFAULT 'pending_provision',
  subscription_status text NOT NULL DEFAULT 'active',
  current_release_id uuid REFERENCES public.platform_releases(id) ON DELETE SET NULL,
  pending_release_id uuid REFERENCES public.platform_releases(id) ON DELETE SET NULL,
  auto_apply_security boolean NOT NULL DEFAULT true,
  last_deployed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_managed_sites_owner ON public.managed_sites(owner_user_id);
CREATE INDEX idx_managed_sites_sub_status ON public.managed_sites(subscription_status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.managed_sites TO authenticated;
GRANT ALL ON public.managed_sites TO service_role;

ALTER TABLE public.managed_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own managed sites"
  ON public.managed_sites FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners update limited fields on own sites"
  ON public.managed_sites FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage all managed sites"
  ON public.managed_sites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_managed_sites_updated_at
  BEFORE UPDATE ON public.managed_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Release events per managed site (audit trail of accept/reject/deploy)
CREATE TABLE public.managed_site_release_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.managed_sites(id) ON DELETE CASCADE,
  release_id uuid NOT NULL REFERENCES public.platform_releases(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_msre_site ON public.managed_site_release_events(site_id, created_at DESC);

GRANT SELECT, INSERT ON public.managed_site_release_events TO authenticated;
GRANT ALL ON public.managed_site_release_events TO service_role;

ALTER TABLE public.managed_site_release_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view events on own sites"
  ON public.managed_site_release_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.managed_sites s
            WHERE s.id = site_id
              AND (s.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

CREATE POLICY "Owners insert events on own sites"
  ON public.managed_site_release_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.managed_sites s
            WHERE s.id = site_id
              AND (s.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
