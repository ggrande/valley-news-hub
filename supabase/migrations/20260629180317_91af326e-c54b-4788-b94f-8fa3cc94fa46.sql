ALTER TABLE public.managed_sites
  ADD COLUMN IF NOT EXISTS network_sync_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.tenant_hidden_network_posts (
  site_id uuid NOT NULL REFERENCES public.managed_sites(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  hidden_by uuid,
  PRIMARY KEY (site_id, post_id)
);

GRANT SELECT, INSERT, DELETE ON public.tenant_hidden_network_posts TO authenticated;
GRANT ALL ON public.tenant_hidden_network_posts TO service_role;

ALTER TABLE public.tenant_hidden_network_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins manage tenant hides"
  ON public.tenant_hidden_network_posts
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS tenant_hidden_network_posts_site_idx
  ON public.tenant_hidden_network_posts(site_id);