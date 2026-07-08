ALTER TABLE public.managed_sites
  ADD COLUMN IF NOT EXISTS legal_terms_md TEXT,
  ADD COLUMN IF NOT EXISTS legal_privacy_md TEXT,
  ADD COLUMN IF NOT EXISTS legal_dmca_md TEXT;