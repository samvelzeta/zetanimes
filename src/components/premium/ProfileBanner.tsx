import { cn } from "@/lib/utils";
import { findBanner } from "@/lib/cosmetics";

interface Props {
  preset?: string | null;
  url?: string | null;
  className?: string;
  height?: number;
  children?: React.ReactNode;
}

export default function ProfileBanner({ preset, url, className, height = 180, children }: Props) {
  const def = findBanner(preset);
  const bg = url ? `url("${url}") center/cover no-repeat` : def.gradient;
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-2xl", className)}
      style={{ height, background: bg }}
    >
      {/* Halo sutil y viñeta */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/85 via-background/30 to-transparent" />
      <div className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-30"
           style={{ background: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4), transparent 60%)" }} />
      {children}
    </div>
  );
}
