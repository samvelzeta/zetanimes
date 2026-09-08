import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { findFrame, RARITY_META, type FrameShape, type AvatarFrameDef } from "@/lib/cosmetics";
import { getAdminFrame } from "@/hooks/useAdminFrames";
import { loadCosmeticsManifest } from "@/lib/cosmetics-manifest";

interface Props {
  frame?: string | null;
  /** Tamaño en px. Pasa null para heredar del padre (usar className w-x h-x). */
  size?: number | null;
  className?: string;
  showRarityGlow?: boolean;
  children: ReactNode;
}

const SHAPE_CLIP: Record<FrameShape, string | undefined> = {
  circle:  undefined,
  hex:     "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  rounded: undefined,
  shield:  "polygon(50% 0%, 100% 20%, 100% 60%, 50% 100%, 0% 60%, 0% 20%)",
  star:    "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
};

function shapeStyle(shape: FrameShape | undefined): React.CSSProperties {
  const s = shape ?? "circle";
  const clip = SHAPE_CLIP[s];
  const style: React.CSSProperties = {};
  if (clip) style.clipPath = clip;
  if (s === "circle") style.borderRadius = "9999px";
  else if (s === "rounded") style.borderRadius = "22%";
  else style.borderRadius = "0";
  return style;
}

export default function AvatarFrame({ frame, size = 80, className, showRarityGlow = true, children }: Props) {
  const isAdminFrame = Boolean(frame?.startsWith("admin:"));
  const [remoteDef, setRemoteDef] = useState<AvatarFrameDef | null>(() =>
    isAdminFrame && frame ? getAdminFrame(frame) ?? null : null
  );

  useEffect(() => {
    if (!isAdminFrame || !frame) {
      setRemoteDef(null);
      return;
    }
    const cached = getAdminFrame(frame);
    if (cached) {
      setRemoteDef(cached);
      return;
    }
    let cancelled = false;
    const id = frame.slice(6);
    loadCosmeticsManifest().then((manifest) => {
      if (cancelled) return;
      const row = manifest.frames.find((item) => item.id === id);
      if (!row) return;
      setRemoteDef({
        slug: frame,
        name: row.name,
        className: "zf-frame-admin",
        shape: (row.shape as FrameShape) || "circle",
        imageUrl: row.image_url || undefined,
        rarity: (row.rarity as AvatarFrameDef["rarity"]) || "basico",
        requirement: { type: "free" },
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [frame, isAdminFrame]);

  const def = isAdminFrame ? remoteDef ?? findFrame("default") : findFrame(frame);

  const outerStyle: React.CSSProperties = size == null ? {} : { width: size, height: size };
  const shape = def.shape ?? "circle";
  const inner = shapeStyle(shape);
  const rarity = RARITY_META[def.rarity];
  const isSkullFrame = def.className.includes("zf-frame-skull");
  const glowFilter = isSkullFrame
    ? "drop-shadow(0 0 12px rgba(255,255,255,0.95)) drop-shadow(0 0 24px rgba(255,255,255,0.55))"
    : `drop-shadow(${rarity.glow})`;

  return (
    <div
      className={cn("zf-frame relative", def.className, `zf-rarity-${def.rarity}`, className)}
      style={{ ...outerStyle, ...(showRarityGlow ? { filter: glowFilter } : {}) }}
      data-shape={shape}
    >
      <div className="zf-frame-inner" style={inner}>
        {children}
      </div>
      {def.imageUrl && (
        <img
          src={def.imageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          style={{ zIndex: 3 }}
        />
      )}
    </div>
  );
}
