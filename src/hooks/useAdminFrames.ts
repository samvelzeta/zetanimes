import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { reqFromAdmin, type AvatarFrameDef, type FrameShape, type Rarity } from "@/lib/cosmetics";

// Cache global para que AvatarFrame pueda resolver `admin:<id>` sin hooks.
const CACHE = new Map<string, AvatarFrameDef>();

export function getAdminFrame(slug: string): AvatarFrameDef | undefined {
  if (!slug.startsWith("admin:")) return undefined;
  return CACHE.get(slug);
}

async function loadOnce() {
  const { data } = await supabase
    .from("admin_frames" as any)
    .select("id,name,image_url,shape,rarity,requirement_type,requirement_value,active")
    .eq("active", true)
    .order("position", { ascending: true });
  const list: AvatarFrameDef[] = (data as any[] | null || []).map((row) => {
    const slug = `admin:${row.id}`;
    const def: AvatarFrameDef = {
      slug,
      name: row.name,
      className: "zf-frame-admin",
      shape: (row.shape as FrameShape) || "circle",
      imageUrl: row.image_url || undefined,
      rarity: (row.rarity as Rarity) || "basico",
      requirement: reqFromAdmin(row.requirement_type, row.requirement_value),
    };
    CACHE.set(slug, def);
    return def;
  });
  return list;
}

/** Hook: lista de marcos subidos por admin (activos). */
export function useAdminFrames() {
  const [frames, setFrames] = useState<AvatarFrameDef[]>(() => Array.from(CACHE.values()));
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancel = false;
    loadOnce().then((list) => {
      if (cancel) return;
      setFrames(list);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, []);
  return { frames, loading };
}
