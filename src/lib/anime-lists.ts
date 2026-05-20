// Lógica multi-tag para listas de anime.
// REGLAS:
// - "favorite" e "undecided" son INDEPENDIENTES: pueden coexistir con cualquier otro estado.
// - "watching" / "completed" / "plan_to_watch" son MUTUAMENTE EXCLUSIVOS: marcar uno desmarca los otros dos.
// - Los registros se aíslan por `profile_id` (perfil activo). Si no hay perfil activo, se trabaja con `profile_id IS NULL`.
import { supabase } from "@/integrations/supabase/client";

export type ListType = "favorite" | "watching" | "completed" | "plan_to_watch" | "undecided";

const EXCLUSIVE_GROUP: ListType[] = ["watching", "completed", "plan_to_watch"];

export function isExclusive(t: ListType) {
  return EXCLUSIVE_GROUP.includes(t);
}

/** Aplica el filtro de profile_id correcto (igual o IS NULL) a un query builder. */
function withProfileScope<T extends { eq: any; is: any }>(q: T, profileId: string | null): T {
  return profileId ? q.eq("profile_id", profileId) : q.is("profile_id", null);
}

/**
 * Toggle multi-tag inteligente.
 * Si el tag ya está activo → lo quita.
 * Si no está y es exclusivo → quita los otros del grupo exclusivo y lo agrega.
 * Si no está y es independiente → solo lo agrega.
 */
export async function toggleAnimeListSmart(params: {
  userId: string;
  profileId: string | null;
  animeId: number;
  list: ListType;
  currentLists: ListType[];
  animeTitle: string;
  animeCover: string;
  /** Si false, el usuario está limitado a 2 estados simultáneos (gate dinámico por plan). */
  isPremium?: boolean;
}): Promise<ListType[]> {
  const { userId, profileId, animeId, list, currentLists, animeTitle, animeCover, isPremium } = params;

  // Gate: máximo 2 estados activos a la vez cuando no hay permiso de multi-selección.
  const FREE_MAX = 2;
  if (!isPremium && !currentLists.includes(list) && currentLists.length >= FREE_MAX) {
    const err = new Error("FREE_LIST_LIMIT");
    (err as any).code = "FREE_LIST_LIMIT";
    throw err;
  }


  // 1. Si ya está marcado → quitar
  if (currentLists.includes(list)) {
    let del = supabase.from("anime_lists").delete()
      .eq("user_id", userId).eq("anime_id", animeId).eq("list_type", list as any);
    del = withProfileScope(del as any, profileId);
    await del;
    return currentLists.filter((l) => l !== list);
  }

  // 2. No está marcado. Determinar qué tags quitar.
  let toRemove: ListType[] = [];
  if (isExclusive(list)) {
    toRemove = currentLists.filter((l) => isExclusive(l));
  }

  if (toRemove.length > 0) {
    let del = supabase.from("anime_lists").delete()
      .eq("user_id", userId).eq("anime_id", animeId)
      .in("list_type", toRemove as any);
    del = withProfileScope(del as any, profileId);
    await del;
  }

  // 3. Insertar el nuevo
  await supabase.from("anime_lists").insert({
    user_id: userId,
    profile_id: profileId,
    anime_id: animeId,
    list_type: list as any,
    anime_title: animeTitle,
    anime_cover: animeCover,
  } as any);

  // 4. Devolver el nuevo set
  const next = currentLists.filter((l) => !toRemove.includes(l));
  next.push(list);
  return next;
}
