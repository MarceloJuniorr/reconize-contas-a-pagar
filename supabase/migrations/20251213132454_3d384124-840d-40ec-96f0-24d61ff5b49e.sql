-- Update storage policies to restrict attachment viewing to authorized roles only
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read attachments" ON storage.objects;

-- Create policy to restrict file access to authorized roles only
CREATE POLICY "Authorized users can view attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments' AND (
      public.has_role(auth.uid(), 'admin'::public.app_role) OR
      public.has_role(auth.uid(), 'operador'::public.app_role) OR
      public.has_role(auth.uid(), 'pagador'::public.app_role)
    )
  );