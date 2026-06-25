DROP POLICY IF EXISTS "Admins manage network releases" ON storage.objects;
CREATE POLICY "Admins manage network releases"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'network-releases' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'network-releases' AND public.has_role(auth.uid(), 'admin'));