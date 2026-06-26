
-- Magic-link login tokens for affiliate-station owners.
CREATE TABLE public.tenant_admin_login_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  site_id UUID REFERENCES public.managed_sites(id) ON DELETE CASCADE,
  requested_ip TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_talt_email ON public.tenant_admin_login_tokens(lower(email));
CREATE INDEX idx_talt_expires ON public.tenant_admin_login_tokens(expires_at);

GRANT ALL ON public.tenant_admin_login_tokens TO service_role;
ALTER TABLE public.tenant_admin_login_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public.tenant_admin_login_tokens FOR ALL USING (false) WITH CHECK (false);

-- Long-lived session tokens issued after a successful magic-link verify.
CREATE TABLE public.tenant_admin_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  site_id UUID REFERENCES public.managed_sites(id) ON DELETE CASCADE,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tas_email ON public.tenant_admin_sessions(lower(email));
CREATE INDEX idx_tas_site ON public.tenant_admin_sessions(site_id);

GRANT ALL ON public.tenant_admin_sessions TO service_role;
ALTER TABLE public.tenant_admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON public.tenant_admin_sessions FOR ALL USING (false) WITH CHECK (false);
