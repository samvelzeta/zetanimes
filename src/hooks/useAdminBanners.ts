import { useEffect, useState } from "react";
import { reqFromAdmin, type BannerPresetDef, type Rarity } from "@/lib/cosmetics";
import { loadAdminBanners } from "@/lib/admin-banner-cache";

export function useAdminBanners() {
  const [banners, setBanners] = useState<BannerPresetDef[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancel = false;
    loadAdminBanners().then((rows) => {
      if (cancel) return;
      setBanners(
        rows.map((row) => ({
          slug: `admin:${row.id}`,
          name: row.name,
          gradient: `url("${row.image_url}") center/cover no-repeat`,
          rarity: (row.rarity as Rarity) || "basico",
          requirement: reqFromAdmin(row.requirement_type, row.requirement_value),
        }))
      );
      setLoading(false);
    });
    return () => { cancel = true; };
  }, []);
  return { banners, loading };
}
