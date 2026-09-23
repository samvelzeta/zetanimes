-- Los bloques (enlaces madre Seeke por rango) estaban protegidos con un trigger
-- que bloqueaba TODO borrado, lo que impedía incluso editarlos o desactivarlos.
-- Ahora el borrado solo se permite dentro de una operación explícitamente
-- autorizada por un admin/owner mediante la función admin_replace_video_blocks.

CREATE OR REPLACE FUNCTION public.prevent_delete_video_cache_blocks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('app.allow_block_delete', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Protected Seeke block master links cannot be deleted without explicit admin authorization';
  END IF;
  RETURN OLD;
END;
$$;

-- Borra los bloques de (anilist_id, lang) tras verificar rol admin/owner.
-- Devuelve la cantidad de filas eliminadas.
CREATE OR REPLACE FUNCTION public.admin_delete_video_blocks(_anilist_id integer, _lang text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted integer := 0;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')) THEN
    RAISE EXCEPTION 'Only admins or the owner can delete Seeke block master links';
  END IF;

  PERFORM set_config('app.allow_block_delete', 'on', true);

  DELETE FROM public.video_cache_blocks
  WHERE anilist_id = _anilist_id AND lang = _lang;
  GET DIAGNOSTICS _deleted = ROW_COUNT;

  PERFORM set_config('app.allow_block_delete', 'off', true);
  RETURN _deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_video_blocks(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_video_blocks(integer, text) TO authenticated;
