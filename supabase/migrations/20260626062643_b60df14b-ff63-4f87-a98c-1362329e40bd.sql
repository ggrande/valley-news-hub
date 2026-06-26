
-- 1) authors.email: ensure column-level SELECT is revoked from anon/authenticated.
REVOKE SELECT (email) ON public.authors FROM anon, authenticated;

-- Keep public read policy but make intent explicit by recreating it limited to safe rows.
DROP POLICY IF EXISTS "authors public read" ON public.authors;
CREATE POLICY "authors public read safe columns"
  ON public.authors FOR SELECT
  TO anon, authenticated
  USING (true);
COMMENT ON POLICY "authors public read safe columns" ON public.authors IS
  'Row-level access is open, but SELECT on the email column is revoked from anon/authenticated via column-level GRANTs. Only service_role and admins (via separate admin policy) can read email.';

-- 2) licenses + license_download_tokens: add explicit service_role policies (documents
-- service-role-only writes; service_role bypasses RLS but explicit policies satisfy audits)
-- and allow authenticated users to look up their own licenses by matching email.
CREATE POLICY "Service role manages licenses"
  ON public.licenses FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "License holders can view their own licenses"
  ON public.licenses FOR SELECT
  TO authenticated
  USING (
    email = (SELECT auth.jwt() ->> 'email')
    OR purchase_id IN (
      SELECT id FROM public.network_purchases WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages license download tokens"
  ON public.license_download_tokens FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 3) network_purchases: add explicit service_role INSERT/management policy.
CREATE POLICY "Service role manages purchases"
  ON public.network_purchases FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
