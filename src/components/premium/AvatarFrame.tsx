import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { findFrame, RARITY_META, type FrameShape, type AvatarFrameDef } from "@/lib/cosmetics";
import { getAdminFrame } from "@/hooks/useAdminFrames";

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
  // Admin frame? Busca en cache; si no está aún, cae al default para no crashear.
  let def: AvatarFrameDef;
  if (frame && frame.startsWith("admin:")) {
    def = getAdminFrame(frame) ?? findFrame("default");
  } else {
    def = findFrame(frame);
  }

  const outerStyle: React.CSSProperties = size == null ? {} : { width: size, height: size };
  const shape = def.shape ?? "circle";
  const inner = shapeStyle(shape);
  const rarity = RARITY_META[def.rarity];

  return (
    <div
      className={cn("zf-frame relative", def.className, `zf-rarity-${def.rarity}`, className)}
      style={{ ...outerStyle, ...(showRarityGlow ? { filter: `drop-shadow(${rarity.glow})` } : {}) }}
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
