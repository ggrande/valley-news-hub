
ALTER TABLE public.managed_sites
  ADD COLUMN IF NOT EXISTS custom_domain_status TEXT NOT NULL DEFAULT 'unset',
  ADD COLUMN IF NOT EXISTS custom_domain_verify_token TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_domain_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS custom_domain_last_error TEXT;

-- Backfill: any pre-existing custom_domain rows are treated as pending verification
UPDATE public.managed_sites
SET custom_domain_status = 'pending'
WHERE custom_domain IS NOT NULL
  AND custom_domain <> ''
  AND custom_domain_status = 'unset';
