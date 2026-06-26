
-- Track every Supabase project creation attempt so we have a paper trail of
-- failed runs, can safely retry without spinning up duplicates, and can detect
-- if a user is trying to exploit failed runs to get multiple stations.

CREATE TABLE public.tenant_provision_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.managed_sites(id) ON DELETE CASCADE,
  session_code TEXT NOT NULL,                        -- diagnostic code (matches WKNA-XXXX-XXXX shown in UI)
  attempted_project_name TEXT NOT NULL,              -- full name we sent to Supabase
  supabase_org_id TEXT NOT NULL,
  supabase_project_ref TEXT,                         -- set when project is known to exist on Supabase
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed','reclaimed','abandoned')),
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_provision_attempts_site ON public.tenant_provision_attempts(site_id);
CREATE INDEX idx_tenant_provision_attempts_org_name
  ON public.tenant_provision_attempts(supabase_org_id, attempted_project_name);

GRANT SELECT ON public.tenant_provision_attempts TO authenticated;
GRANT ALL ON public.tenant_provision_attempts TO service_role;

ALTER TABLE public.tenant_provision_attempts ENABLE ROW LEVEL SECURITY;

-- Owners can see their own attempts; admins can see everything.
CREATE POLICY "Owners view their station's provision attempts"
  ON public.tenant_provision_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.managed_sites ms
      WHERE ms.id = tenant_provision_attempts.site_id
        AND (ms.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );

CREATE TRIGGER trg_tenant_provision_attempts_updated_at
  BEFORE UPDATE ON public.tenant_provision_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill the one known failed attempt (test station).
INSERT INTO public.tenant_provision_attempts
  (site_id, session_code, attempted_project_name, supabase_org_id, status, error, started_at, finished_at)
SELECT
  ms.id,
  'BACKFILL',
  'Test Affiliate Station (test-station-e460d3)',
  ms.supabase_org_id,
  'failed',
  ms.provision_error,
  ms.provision_started_at,
  ms.provision_started_at
FROM public.managed_sites ms
WHERE ms.id = 'd3d2ac08-16f7-432e-8507-48e80eea3415'
  AND ms.provision_state = 'failed'
ON CONFLICT DO NOTHING;
