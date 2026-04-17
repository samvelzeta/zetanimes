// Lógica multi-tag para listas de anime.
// REGLAS:
// - "favorite" e "undecided" son INDEPENDIENTES: pueden coexistir con cualquier otro estado.
// - "watching" / "completed" / "plan_to_watch" son MUTUAMENTE EXCLUSIVOS: marcar uno desmarca los otros dos.
import { supabase } from "@/integrations/supabase/client";

export type ListType = "favorite" | "watching" | "completed" | "plan_to_watch" | "undecided";

const EXCLUSIVE_GROUP: ListType[] = ["watching", "completed", "plan_to_watch"];

export function isExclusive(t: ListType) {
  return EXCLUSIVE_GROUP.includes(t);
}

/**
 * Toggle multi-tag inteligente.
 * Si el tag ya está activo → lo quita.
 * Si no está y es exclusivo → quita los otros del grupo exclusivo y lo agrega.
 * Si no está y es independiente → solo lo agrega.
 */
export async function toggleAnimeListSmart(params: {
  userId: string;
  animeId: number;
  list: ListType;
  currentLists: ListType[];
  animeTitle: string;
  animeCover: string;
}): Promise<ListType[]> {
  const { userId, animeId, list, currentLists, animeTitle, animeCover } = params;

  // 1. Si ya está marcado → quitar
  if (currentLists.includes(list)) {
    await supabase.from("anime_lists").delete()
      .eq("user_id", userId).eq("anime_id", animeId).eq("list_type", list as any);
    return currentLists.filter((l) => l !== list);
  }

  // 2. No está marcado. Determinar qué tags quitar.
  let toRemove: ListType[] = [];
  if (isExclusive(list)) {
    toRemove = currentLists.filter((l) => isExclusive(l));
  }

  if (toRemove.length > 0) {
    await supabase.from("anime_lists").delete()
      .eq("user_id", userId).eq("anime_id", animeId)
      .in("list_type", toRemove as any);
  }

  // 3. Insertar el nuevo
  await supabase.from("anime_lists").insert({
    user_id: userId,
    anime_id: animeId,
    list_type: list as any,
    anime_title: animeTitle,
    anime_cover: animeCover,
  });

  // 4. Devolver el nuevo set
  const next = currentLists.filter((l) => !toRemove.includes(l));
  next.push(list);
  return next;
}
