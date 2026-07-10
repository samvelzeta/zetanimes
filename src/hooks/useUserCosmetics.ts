import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserCosmetics {
  avatar_frame: string;
  name_effect: string;
  cursor_theme: string;
  banner_preset: string;
  banner_url: string | null;
}

const DEFAULTS: UserCosmetics = {
  avatar_frame: "default",
  name_effect: "default",
  cursor_theme: "default",
  banner_preset: "aurora",
  banner_url: null,
};

// Cache en memoria por user_id → evita recargas al navegar.
const CACHE = new Map<string, UserCosmetics>();

async function fetchCosmetics(userId: string): Promise<UserCosmetics> {
  const { data } = await supabase
    .from("user_cosmetics" as any)
    .select("avatar_frame,name_effect,cursor_theme,banner_preset,banner_url")
    .eq("user_id", userId)
    .maybeSingle();
  const row = (data as any) ?? {};
  return {
    avatar_frame: row.avatar_frame ?? DEFAULTS.avatar_frame,
    name_effect: row.name_effect ?? DEFAULTS.name_effect,
    cursor_theme: row.cursor_theme ?? DEFAULTS.cursor_theme,
    banner_preset: row.banner_preset ?? DEFAULTS.banner_preset,
    banner_url: row.banner_url ?? null,
  };
}

/** Hook para leer y actualizar los cosméticos activos del usuario logueado. */
export function useUserCosmetics() {
  const { user } = useAuth();
  const [cosmetics, setCosmetics] = useState<UserCosmetics>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    if (!user) {
      setCosmetics(DEFAULTS);
      setLoading(false);
      return;
    }
    const cached = CACHE.get(user.id);
    if (cached) {
      setCosmetics(cached);
      setLoading(false);
    }
    fetchCosmetics(user.id).then((c) => {
      if (cancel) return;
      CACHE.set(user.id, c);
      setCosmetics(c);
      setLoading(false);
    });

    const ch = supabase
      .channel(`cosmetics-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_cosmetics", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = (payload.new as any) ?? DEFAULTS;
          const next: UserCosmetics = {
            avatar_frame: row.avatar_frame ?? DEFAULTS.avatar_frame,
            name_effect: row.name_effect ?? DEFAULTS.name_effect,
            cursor_theme: row.cursor_theme ?? DEFAULTS.cursor_theme,
            banner_preset: row.banner_preset ?? DEFAULTS.banner_preset,
            banner_url: row.banner_url ?? null,
          };
          CACHE.set(user.id, next);
          setCosmetics(next);
        }
      )
      .subscribe();
    return () => {
      cancel = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  const update = useCallback(
    async (patch: Partial<UserCosmetics>) => {
      if (!user) return;
      const next = { ...cosmetics, ...patch };
      setCosmetics(next);
      CACHE.set(user.id, next);
      const { error } = await supabase
        .from("user_cosmetics" as any)
        .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
      if (error) throw error;
    },
    [user, cosmetics]
  );

  return { cosmetics, loading, update };
}

/** Lectura puntual (sin subscripción realtime) para páginas de ranking. */
export async function loadCosmeticsBatch(userIds: string[]): Promise<Map<string, UserCosmetics>> {
  const out = new Map<string, UserCosmetics>();
  if (!userIds.length) return out;
  const { data } = await supabase
    .from("user_cosmetics" as any)
    .select("user_id,avatar_frame,name_effect,cursor_theme,banner_preset,banner_url")
    .in("user_id", userIds);
  (data as any[] | null)?.forEach((row) => {
    out.set(row.user_id, {
      avatar_frame: row.avatar_frame ?? DEFAULTS.avatar_frame,
      name_effect: row.name_effect ?? DEFAULTS.name_effect,
      cursor_theme: row.cursor_theme ?? DEFAULTS.cursor_theme,
      banner_preset: row.banner_preset ?? DEFAULTS.banner_preset,
      banner_url: row.banner_url ?? null,
    });
  });
  return out;
}

export const DEFAULT_COSMETICS = DEFAULTS;
