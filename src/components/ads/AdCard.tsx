import { useLayoutEffect, useRef, useState, forwardRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { primeAdDomains, shouldBootAdsImmediately } from "@/lib/ad-boot";
import { getAdsConfig, adsNativeScript } from "@/config/ads";

interface Props {
  size?: "small" | "default" | "large";
  className?: string;
}

const NATIVE_KEY = getAdsConfig().nativeKey;
const NATIVE_SCRIPT = adsNativeScript(NATIVE_KEY);

/**
 * Native banner Adsterra estilo "card" auditado.
 * - Soporta forwardRef para evitar warnings en layouts complejos.
 * - Usa iframes aislados para evitar colisiones de IDs.
 */
const AdCard = forwardRef<HTMLDivElement, Props>(({ size = "default", className = "" }, ref) => {
  const { isPremium, loading } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const [adFilled, setAdFilled] = useState<boolean | null>(null);
  const canBootAds = shouldBootAdsImmediately(loading, isPremium);

  useLayoutEffect(() => {
    if (!NATIVE_KEY || !canBootAds || loaded.current || !containerRef.current) return;
    loaded.current = true;
    primeAdDomains();

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
    containerRef.current.appendChild(iframe);

    const timers: number[] = [];
    const probe = (final: boolean) => {
      try {
        const doc = iframe.contentWindow?.document;
        const slot = doc?.getElementById(`container-${NATIVE_KEY}`);
        const filled = !!slot && (
          slot.childElementCount > 0 ||
          (slot.textContent || "").trim().length > 0 ||
          slot.querySelector("iframe, img, a, video") !== null
        );
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
  if (!NATIVE_KEY || adFilled === false) return null;

  const sizeClasses = {
    small: "w-28",
    default: "w-36",
    large: "w-44",
  }[size];

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={adFilled === true
        ? `${sizeClasses} flex-shrink-0 ${className}`
        : "fixed -left-[10000px] top-0 h-48 w-36 pointer-events-none opacity-0"
      }
      aria-hidden={adFilled !== true}
    >
      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-secondary border border-primary/30 relative shadow-lg">
        <div className="absolute top-1 right-1 z-10 px-1.5 py-0.5 rounded bg-black/60 text-[8px] font-bold text-primary uppercase tracking-wider pointer-events-none">
          Ad
        </div>
        <div className="w-full h-full" />
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground/60 text-center">
        Patrocinado
      </p>
    </div>
  );
});

AdCard.displayName = "AdCard";

export default AdCard;
