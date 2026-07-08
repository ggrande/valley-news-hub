
-- ===== Batch D: Rate limits + captcha =====
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  managed_site_id UUID REFERENCES public.managed_sites(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_scope_key_time ON public.rate_limit_events(scope, key, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_site_time ON public.rate_limit_events(managed_site_id, occurred_at DESC);

GRANT SELECT ON public.rate_limit_events TO authenticated;
GRANT ALL ON public.rate_limit_events TO service_role;

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view rate limit events"
  ON public.rate_limit_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages rate limit events"
  ON public.rate_limit_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.managed_sites
  ADD COLUMN IF NOT EXISTS captcha_provider TEXT NOT NULL DEFAULT 'none' CHECK (captcha_provider IN ('none','turnstile','recaptcha')),
  ADD COLUMN IF NOT EXISTS captcha_site_key TEXT,
  ADD COLUMN IF NOT EXISTS captcha_secret_key_enc TEXT;

-- ===== Batch C: Abuse reports =====
CREATE TABLE IF NOT EXISTS public.abuse_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  managed_site_id UUID REFERENCES public.managed_sites(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('post','comment','other')),
  target_id TEXT NOT NULL,
  target_url TEXT,
  reporter_email TEXT,
  reporter_ip_hash TEXT,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','dismissed','actioned')),
  admin_notes TEXT,
  actioned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_status ON public.abuse_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_site ON public.abuse_reports(managed_site_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.abuse_reports TO authenticated;
GRANT INSERT ON public.abuse_reports TO anon;
GRANT ALL ON public.abuse_reports TO service_role;

ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an abuse report"
  ON public.abuse_reports FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(reason) BETWEEN 3 AND 200
    AND length(coalesce(details,'')) <= 4000
    AND target_kind IN ('post','comment','other')
    AND status = 'open'
    AND actioned_by IS NULL
    AND actioned_at IS NULL
    AND admin_notes IS NULL
  );

CREATE POLICY "Admins view abuse reports"
  ON public.abuse_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update abuse reports"
  ON public.abuse_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_abuse_reports_updated
  BEFORE UPDATE ON public.abuse_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Batch E: Observability =====
CREATE TABLE IF NOT EXISTS public.tenant_error_events (
  id BIGSERIAL PRIMARY KEY,
  managed_site_id UUID REFERENCES public.managed_sites(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenant_error_events_time ON public.tenant_error_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_error_events_site_time ON public.tenant_error_events(managed_site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_error_events_kind_time ON public.tenant_error_events(kind, created_at DESC);

GRANT SELECT ON public.tenant_error_events TO authenticated;
GRANT ALL ON public.tenant_error_events TO service_role;

ALTER TABLE public.tenant_error_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view tenant error events"
  ON public.tenant_error_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages tenant error events"
  ON public.tenant_error_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);
