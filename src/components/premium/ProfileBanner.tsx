import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { findBanner } from "@/lib/cosmetics";
import { getAdminBannerSync, getAdminBanner } from "@/lib/admin-banner-cache";

interface Props {
  preset?: string | null;
  url?: string | null;
  className?: string;
  height?: number;
  children?: React.ReactNode;
}

export default function ProfileBanner({ preset, url, className, height = 180, children }: Props) {
  const adminId = preset?.startsWith("admin:") ? preset.slice(6) : null;

  // Resolución inmediata desde el caché compartido (evita el parpadeo/gradiente).
  const [adminUrl, setAdminUrl] = useState<string | null>(() =>
    adminId ? getAdminBannerSync(adminId)?.image_url ?? null : null
  );

  useEffect(() => {
    if (!adminId) { setAdminUrl(null); return; }
    const sync = getAdminBannerSync(adminId)?.image_url ?? null;
    if (sync) { setAdminUrl(sync); return; }
    let cancel = false;
    getAdminBanner(adminId).then((row) => {
      if (!cancel) setAdminUrl(row?.image_url ?? null);
    });
    return () => { cancel = true; };
  }, [adminId]);

  const def = findBanner(preset);
  const imageUrl = url || adminUrl;
  const bg = imageUrl ? `url("${imageUrl}") center/cover no-repeat` : def.gradient;

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-2xl", className)}
      style={{ height, background: def.gradient }}
    >
      {imageUrl && (
        <div
          className="absolute inset-0"
          style={{ background: bg }}
          aria-hidden
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/85 via-background/30 to-transparent" />
      <div className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-30"
           style={{ background: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4), transparent 60%)" }} />
      {children}
    </div>
  );
}
