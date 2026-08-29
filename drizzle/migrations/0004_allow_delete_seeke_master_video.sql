-- Permite eliminar el enlace madre Seeke (episode=0) desde el panel admin.
-- La UI ahora muestra un diálogo de confirmación antes de borrar, por lo que
-- la protección a nivel base de datos ya no es necesaria.
DROP TRIGGER IF EXISTS trg_prevent_delete_seeke_master_video ON public.video_cache;
DROP FUNCTION IF EXISTS public.prevent_delete_seeke_master_video();