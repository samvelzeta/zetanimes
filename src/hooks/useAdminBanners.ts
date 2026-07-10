import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { reqFromAdmin, type BannerPresetDef } from "@/lib/cosmetics";

/**
 * Lee la lista de banners subidos por admin (activos) y los expone
 * con el mismo shape que los presets locales para poder mezclarlos.
 * El slug remoto usa prefijo `admin:` para no colisionar con los locales.
 */
export function useAdminBanners() {
  const [banners, setBanners] = useState<BannerPresetDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("admin_banners" as any)
        .select("id,name,image_url,requirement_type,requirement_value,position,active")
        .eq("active", true)
        .order("position", { ascending: true });
      if (cancel) return;
      const list: BannerPresetDef[] = (data as any[] | null || []).map((row) => ({
        slug: `admin:${row.id}`,
        name: row.name,
        gradient: `url("${row.image_url}") center/cover no-repeat`,
        requirement: reqFromAdmin(row.requirement_type, row.requirement_value),
      }));
      setBanners(list);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  return { banners, loading };
}
