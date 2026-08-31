import { useEffect, useState } from "react";
import { loadCosmeticsManifest } from "@/lib/cosmetics-manifest";
import { reqFromAdmin, type AvatarFrameDef, type FrameShape, type Rarity } from "@/lib/cosmetics";

// Cache global para que AvatarFrame pueda resolver `admin:<id>` sin hooks.
const CACHE = new Map<string, AvatarFrameDef>();

export function getAdminFrame(slug: string): AvatarFrameDef | undefined {
  if (!slug.startsWith("admin:")) return undefined;
  return CACHE.get(slug);
}

async function loadOnce() {
  // Manifiesto cacheado permanentemente en Cloudflare KV (memoria → IDB → KV → DB).
  const manifest = await loadCosmeticsManifest();
  const list: AvatarFrameDef[] = (manifest.frames as any[]).map((row) => {
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
