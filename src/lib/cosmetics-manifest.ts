import { supabase } from "@/integrations/supabase/client";
import { idbGet, idbSet } from "@/lib/idb-cache";

export interface ManifestFrame {
  id: string;
  name: string;
  image_url: string | null;
  shape: string;
  rarity: string;
  requirement_type: string;
  requirement_value: number;
  position: number;
}

export interface ManifestBanner {
  id: string;
  name: string;
  image_url: string;
  requirement_type: "free" | "level" | "premium" | "gacha";
  requirement_value: number;
  rarity: string;
  position: number;
}

export interface CosmeticsManifest {
  frames: ManifestFrame[];
  banners: ManifestBanner[];
}

const IDB_KEY = "cosmetics-manifest:v1";
const TTL = 7 * 24 * 60 * 60 * 1000; // 7 días (imágenes R2 immutable)

let memo: CosmeticsManifest | null = null;
let inflight: Promise<CosmeticsManifest> | null = null;

async function fetchManifest(): Promise<CosmeticsManifest> {
  const { data, error } = await supabase.functions.invoke("cosmetics-manifest", { body: {} });
  if (error) throw error;
  return {
    frames: (data as any)?.frames ?? [],
    banners: (data as any)?.banners ?? [],
  };
}

/** Manifiesto de cosméticos: memoria → IndexedDB → KV (edge) → DB. */
export async function loadCosmeticsManifest(): Promise<CosmeticsManifest> {
  if (memo) return memo;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const cached = await idbGet<CosmeticsManifest>(IDB_KEY);
      if (cached && (cached.frames?.length || cached.banners?.length)) {
        memo = cached;
        // Revalidación silenciosa
        fetchManifest()
          .then((fresh) => {
            if (!fresh.frames.length && !fresh.banners.length) return;
            memo = fresh;
            idbSet(IDB_KEY, fresh, TTL);
          })
          .catch(() => {});
        return cached;
      }
      try {
        const fresh = await fetchManifest();
        memo = fresh;
        idbSet(IDB_KEY, fresh, TTL);
        return fresh;
      } catch {
        memo = { frames: [], banners: [] };
        return memo;
      }
    } finally {
      inflight = null;
    }
  })();


  return inflight;
}

export function getCosmeticsManifestSync(): CosmeticsManifest | null {
  return memo;
}

/** Invalida memoria + IndexedDB + KV (tras CRUD del admin). */
export async function invalidateCosmeticsManifest() {
  memo = null;
  inflight = null;
  await idbSet(IDB_KEY, { frames: [], banners: [] }, 0);
  try {
    await supabase.functions.invoke("cosmetics-manifest", { body: { action: "invalidate" } });
  } catch {
    /* noop */
  }
}
