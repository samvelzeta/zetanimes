import { supabase } from "@/integrations/supabase/client";
import { loadAdminBanners, warmImages } from "@/lib/admin-banner-cache";

let preloadPromise: Promise<void> | null = null;

/**
 * Precarga en el caché HTTP del navegador los overlays de marcos y las
 * imágenes de banners activos (ya cacheadas en IndexedDB por 24h).
 * Idempotente: se ejecuta una sola vez por sesión.
 */
export function preloadAdminCosmetics(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    try {
      const [{ data: frames }, banners] = await Promise.all([
        supabase.from("admin_frames" as any).select("image_url").eq("active", true),
        loadAdminBanners(),
      ]);
      warmImages(banners);
      (frames as any[] | null)?.forEach((r) => {
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
