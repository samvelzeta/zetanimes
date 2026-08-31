import { loadCosmeticsManifest } from "@/lib/cosmetics-manifest";
import { warmImages } from "@/lib/admin-banner-cache";

let preloadPromise: Promise<void> | null = null;

/**
 * Precarga en el caché HTTP del navegador los overlays de marcos y las
 * imágenes de banners activos (manifiesto cacheado en Cloudflare KV).
 * Idempotente: se ejecuta una sola vez por sesión.
 */
export function preloadAdminCosmetics(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    try {
      const { frames, banners } = await loadCosmeticsManifest();
      warmImages(banners as any);
      frames.forEach((r) => {
        if (!r?.image_url) return;
        const img = new Image();
        img.decoding = "async";
        (img as any).fetchPriority = "low";
        img.src = r.image_url;
      });
    } catch (err) {
      console.warn("[cosmetics-preload] fallo", err);
    }
  })();
  return preloadPromise;
}
