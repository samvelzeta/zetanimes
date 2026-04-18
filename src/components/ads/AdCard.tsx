import { useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { primeAdDomains, shouldBootAdsImmediately } from "@/lib/ad-boot";

/**
 * Native banner Adsterra estilo "card" (mismo tamaño que AnimeCard).
 * - Cada AdCard usa su PROPIO iframe aislado para que el script de Adsterra
 *   pueda renderizarse múltiples veces en la misma página sin colisionar
 *   por el ID del contenedor (problema típico cuando hay varios AdCard).
 * - Premium: render 0×0 (sin scripts).
 * - Free pero ad no carga (adblock/sin inventario): se colapsa.
 */
interface Props {
  size?: "small" | "default" | "large";
}

const NATIVE_KEY = "f22e36f62a5acf07d25a8dd129e84655";
const NATIVE_SCRIPT = `https://pl29176506.profitablecpmratenetwork.com/${NATIVE_KEY}/invoke.js`;

export default function AdCard({ size = "default" }: Props) {
  const { isPremium, loading } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const [adFilled, setAdFilled] = useState<boolean | null>(null);
  const canBootAds = shouldBootAdsImmediately(loading, isPremium);

  useLayoutEffect(() => {
    if (!canBootAds || loaded.current || !ref.current) return;
    loaded.current = true;
    primeAdDomains();

    // HTML aislado dentro de un iframe: cada anuncio se carga de forma
    // independiente con su propio contenedor, evitando colisión de IDs.
    const html = `
      <!doctype html>
      <html>
        <head>
          <style>
            html,body{margin:0;padding:0;background:transparent;width:100%;height:100%;overflow:hidden;}
            #container-${NATIVE_KEY}{width:100%;height:100%;}
            #container-${NATIVE_KEY} img{width:100% !important;height:100% !important;object-fit:cover;}
            #container-${NATIVE_KEY} iframe{width:100% !important;height:100% !important;border:0;}
          </style>
        </head>
        <body>
          <div id="container-${NATIVE_KEY}"></div>
          <script async data-cfasync="false" src="${NATIVE_SCRIPT}"></script>
        </body>
      </html>
    `;

    const iframe = document.createElement("iframe");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.loading = "eager";
    iframe.scrolling = "no";
    iframe.setAttribute("fetchpriority", "high");
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
    );
    iframe.srcdoc = html;
    ref.current.appendChild(iframe);

    // Reintentos progresivos: 3s, 6s, 10s. Marca failed solo al último.
    const timers: number[] = [];
    const probe = (final: boolean) => {
      try {
        const body = iframe.contentWindow?.document?.body;
        const filled = !!body && body.innerHTML.length > 200;
        if (filled) { setAdFilled(true); return; }
        if (final) setAdFilled(false);
      } catch {
        setAdFilled(true);
      }
    };
    timers.push(window.setTimeout(() => probe(false), 1200));
    timers.push(window.setTimeout(() => probe(false), 3000));
    timers.push(window.setTimeout(() => probe(false), 6000));
    timers.push(window.setTimeout(() => probe(true), 10000));
    return () => { timers.forEach(clearTimeout); };
  }, [canBootAds]);

  if (isPremium) {
    return <div style={{ width: 0, height: 0, overflow: "hidden" }} aria-hidden />;
  }
  if (adFilled === false) return null;

  const sizeClasses = {
    small: "w-28",
    default: "w-36",
    large: "w-44",
  }[size];

  return (
    <div className={`${sizeClasses} flex-shrink-0`}>
      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-secondary border border-primary/30 relative shadow-lg">
        <div className="absolute top-1 right-1 z-10 px-1.5 py-0.5 rounded bg-black/60 text-[8px] font-bold text-primary uppercase tracking-wider pointer-events-none">
          Ad
        </div>
        <div ref={ref} className="w-full h-full" />
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground/60 text-center">
        Patrocinado
      </p>
    </div>
  );
}
