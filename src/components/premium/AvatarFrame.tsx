import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { findFrame } from "@/lib/cosmetics";

interface Props {
  frame?: string | null;
  size?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Envoltura visual del avatar con marco animado.
 * Los estilos concretos viven en index.css (.zf-frame-*).
 */
export default function AvatarFrame({ frame, size = 80, className, children }: Props) {
  const def = findFrame(frame);
  return (
    <div
      className={cn("zf-frame", def.className, className)}
      style={{ width: size, height: size }}
    >
      <div className="zf-frame-inner">{children}</div>
    </div>
  );
}
