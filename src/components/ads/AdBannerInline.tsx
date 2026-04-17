// Banner Adsterra inline reutilizable (iframe).
// Inyecta atOptions + invoke.js dentro de un iframe SANDBOX aislado para
// permitir múltiples instancias en la misma página sin colisión de IDs.
// Premium = 0×0 sin scripts. Si no carga (adblock / sin inventario) → colapsa.
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type AdBannerSize =
  | "728x90"   // leaderboard
  | "468x60"   // banner
  | "300x250" // medium rectangle
  | "160x600" // wide skyscraper
  | "160x300"; // half skyscraper

const KEYS: Record<AdBannerSize, { key: string; w: number; h: number }> = {
  "728x90":  { key: "1d178d24c436e987f0076c89491f7ba5", w: 728, h: 90 },
  "468x60":  { key: "8672e32915f1e9d41edf058deec91989", w: 468, h: 60 },
  "300x250": { key: "b411f21fa26a4e8427eb13433959b4e8", w: 300, h: 250 },
  "160x600": { key: "d4813a34656155529b56e4655b81cbdb", w: 160, h: 600 },
  "160x300": { key: "ab525e23c9a041206c6d3096e5581274", w: 160, h: 300 },
};

interface Props {
  size: AdBannerSize;
  /** Clases extra para el wrapper (margen, alineación). */
  className?: string;
  /** Oculta el label "Patrocinado". */
  hideLabel?: boolean;
}

export default function AdBannerInline({ size, className = "", hideLabel = false }: Props) {
  const { isPremium } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const [filled, setFilled] = useState<boolean | null>(null);

  const cfg = KEYS[size];

  useEffect(() => {
    if (isPremium || loaded.current || !ref.current) return;
    loaded.current = true;

    const html = `
      <!doctype html><html><head><style>
        html,body{margin:0;padding:0;background:transparent;width:100%;height:100%;overflow:hidden;}
        iframe{display:block;margin:0 auto;}
      </style></head><body>
        <script type="text/javascript">
          atOptions = { 'key':'${cfg.key}', 'format':'iframe', 'height':${cfg.h}, 'width':${cfg.w}, 'params':{} };
        </script>
        <script type="text/javascript" src="https://www.highperformanceformat.com/${cfg.key}/invoke.js"></script>
      </body></html>
    `;

    const iframe = document.createElement("iframe");
    iframe.style.width = `${cfg.w}px`;
    iframe.style.height = `${cfg.h}px`;
    iframe.style.border = "0";
    iframe.style.display = "block";
    iframe.scrolling = "no";
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
    );
    ref.current.appendChild(iframe);
    try {
      iframe.contentWindow?.document.open();
      iframe.contentWindow?.document.write(html);
      iframe.contentWindow?.document.close();
    } catch { /* ignore */ }

    const t = setTimeout(() => {
      try {
        const body = iframe.contentWindow?.document?.body;
        const ok = !!body && (body.querySelector("iframe") !== null || body.innerHTML.length > 200);
        setFilled(ok);
      } catch {
        setFilled(true);
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [isPremium, cfg.key, cfg.w, cfg.h]);

  if (isPremium) return <div aria-hidden style={{ width: 0, height: 0, overflow: "hidden" }} />;
  if (filled === false) return null;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {!hideLabel && (
        <span className="text-[9px] text-muted-foreground/70 uppercase tracking-widest mb-1">
          Patrocinado
        </span>
      )}
      <div
        ref={ref}
        style={{ width: cfg.w, height: cfg.h }}
        className="bg-secondary/30 border border-border/40 rounded-lg overflow-hidden max-w-full"
      />
    </div>
  );
}
