import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { findBanner } from "@/lib/cosmetics";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  preset?: string | null;
  url?: string | null;
  className?: string;
  height?: number;
  children?: React.ReactNode;
}

export default function ProfileBanner({ preset, url, className, height = 180, children }: Props) {
  // Si el preset es un banner del admin (admin:<id>), lo resolvemos aquí.
  const [adminBg, setAdminBg] = useState<string | null>(null);
  useEffect(() => {
    if (!preset?.startsWith("admin:")) { setAdminBg(null); return; }
    const id = preset.slice(6);
    let cancel = false;
    supabase
      .from("admin_banners" as any)
      .select("image_url")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancel || !data) return;
        setAdminBg(`url("${(data as any).image_url}") center/cover no-repeat`);
      });
    return () => { cancel = true; };
  }, [preset]);

  const def = findBanner(preset);
  const bg = url ? `url("${url}") center/cover no-repeat` : (adminBg ?? def.gradient);
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-2xl", className)}
      style={{ height, background: bg }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/85 via-background/30 to-transparent" />
      <div className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-30"
           style={{ background: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4), transparent 60%)" }} />
      {children}
    </div>
  );
}
