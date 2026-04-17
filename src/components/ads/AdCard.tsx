import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Native banner Adsterra estilo "card" (mismo tamaño que AnimeCard).
 * - Premium: render 0×0 (sin scripts).
 * - Free pero ad no carga (adblock/sin inventario): se colapsa para no dejar hueco negro.
 */
interface Props {
  size?: "small" | "default" | "large";
}

const SCRIPT_SRC =
  "https://pl29176506.profitablecpmratenetwork.com/f22e36f62a5acf07d25a8dd129e84655/invoke.js";
const CONTAINER_ID = "container-f22e36f62a5acf07d25a8dd129e84655";

export default function AdCard({ size = "default" }: Props) {
  const { isPremium } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const [adFilled, setAdFilled] = useState<boolean | null>(null); // null = checking

  useEffect(() => {
    if (isPremium || loaded.current || !ref.current) return;
    loaded.current = true;
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const s = document.createElement("script");
      s.async = true;
      (s as any)["data-cfasync"] = "false";
      s.src = SCRIPT_SRC;
      document.body.appendChild(s);
    }
    // Verificar si el contenedor recibió contenido tras 2.5s
    const t = setTimeout(() => {
      if (ref.current && ref.current.children.length > 0) {
        setAdFilled(true);
      } else {
        setAdFilled(false);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [isPremium]);

  // Premium o ad no llenado → ocultar completamente (colapsa el hueco)
  if (isPremium || adFilled === false) {
    return null;
  }

  const sizeClasses = {
    small: "w-28",
    default: "w-36",
    large: "w-44",
  }[size];

  return (
    <div className={`${sizeClasses} flex-shrink-0`}>
      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-secondary border border-primary/30 relative shadow-lg">
        <div className="absolute top-1 right-1 z-10 px-1.5 py-0.5 rounded bg-black/60 text-[8px] font-bold text-primary uppercase tracking-wider">
          Ad
        </div>
        <div
          ref={ref}
          id={CONTAINER_ID}
          className="w-full h-full [&_img]:!w-full [&_img]:!h-full [&_img]:!object-cover [&_iframe]:!w-full [&_iframe]:!h-full"
          style={{ overflow: "hidden" }}
        />
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground/60 text-center">
        Patrocinado
      </p>
    </div>
  );
}
