-- Disable anonymous writes; admin uploads use server-only service role.
DROP POLICY IF EXISTS "Izinkan upload foto menu" ON storage.objects;
