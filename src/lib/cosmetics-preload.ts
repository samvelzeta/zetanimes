import { supabase } from "@/integrations/supabase/client";

let preloadPromise: Promise<void> | null = null;

/**
 * Precarga en el caché HTTP del navegador todos los overlays de marcos
 * y las imágenes de banners activos subidos por el admin, para que cuando
 * el usuario abra el perfil / picker no tenga que esperar la descarga.
 *
 * Se ejecuta una sola vez por sesión (idempotente).
 */
export function preloadAdminCosmetics(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    try {
      const [{ data: frames }, { data: banners }] = await Promise.all([
        supabase.from("admin_frames" as any).select("image_url").eq("active", true),
        supabase.from("admin_banners" as any).select("image_url").eq("active", true),
      ]);
      const urls = new Set<string>();
      (frames as any[] | null)?.forEach((r) => r?.image_url && urls.add(r.image_url));
      (banners as any[] | null)?.forEach((r) => r?.image_url && urls.add(r.image_url));
      // Warm HTTP cache de forma no bloqueante
      urls.forEach((url) => {
        const img = new Image();
        img.decoding = "async";
        (img as any).fetchPriority = "low";
        img.src = url;
      });
    } catch (err) {
      console.warn("[cosmetics-preload] fallo", err);
    }
  })();
  return preloadPromise;
}
