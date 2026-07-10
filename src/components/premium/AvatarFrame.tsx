import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { findFrame } from "@/lib/cosmetics";

interface Props {
  frame?: string | null;
  /** Tamaño fijo en px. Pasa `null` para heredar del padre (usar className w-*/h-*). */
  size?: number | null;
  className?: string;
  children: ReactNode;
}

/**
 * Envoltura visual del avatar con marco animado.
 * Los estilos concretos viven en index.css (.zf-frame-*).
 */
export default function AvatarFrame({ frame, size = 80, className, children }: Props) {
  const def = findFrame(frame);
  const style = size == null ? undefined : { width: size, height: size };
  return (
    <div className={cn("zf-frame", def.className, className)} style={style}>
      <div className="zf-frame-inner">{children}</div>
    </div>
  );
}

