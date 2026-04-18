-- Habilitar replica identity completa para que los cambios incluyan toda la fila
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;

-- Agregar la tabla a la publicación de realtime (si ya está, no falla)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  END IF;
END $$;