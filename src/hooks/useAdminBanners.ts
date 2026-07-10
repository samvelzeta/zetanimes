import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { reqFromAdmin, type BannerPresetDef, type Rarity } from "@/lib/cosmetics";

export function useAdminBanners() {
  const [banners, setBanners] = useState<BannerPresetDef[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("admin_banners" as any)
        .select("id,name,image_url,requirement_type,requirement_value,rarity,position,active")
        .eq("active", true)
        .order("position", { ascending: true });
      if (cancel) return;
      const list: BannerPresetDef[] = (data as any[] | null || []).map((row) => ({
        slug: `admin:${row.id}`,
        name: row.name,
        gradient: `url("${row.image_url}") center/cover no-repeat`,
        rarity: (row.rarity as Rarity) || "basico",
        requirement: reqFromAdmin(row.requirement_type, row.requirement_value),
      }));
      setBanners(list);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);
  return { banners, loading };
}
