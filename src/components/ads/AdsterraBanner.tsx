// Ad Adsterra — patrón correcto:
// El script de Adsterra define `atOptions` y luego llama invoke.js que reemplaza el contenedor
// con el iframe del ad. Como React es SPA y los <script> JSX no se ejecutan, hay que:
// 1) Crear los <script> con document.createElement
// 2) Asignarles el atOptions ANTES del invoke.js
// 3) Appendar al body, y poner un container con el ID que invoke.js usa
import { useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { primeAdDomains, shouldBootAdsImmediately } from "@/lib/ad-boot";

interface Props {
  adKey: string;
  width: number;
  height: number;
  /** Identificador único para esta instancia (evita colisiones cuando hay varios ads en la página) */
  uid: string;
}

export default function AdsterraBanner({ adKey, width, height, uid }: Props) {
  const { isPremium, loading } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const injected = useRef(false);
  const [failed, setFailed] = useState(false);
  const canBootAds = shouldBootAdsImmediately(loading, isPremium);

  useLayoutEffect(() => {
    if (!canBootAds || injected.current || !ref.current) return;
    injected.current = true;
    primeAdDomains();

    const container = ref.current;
    container.innerHTML = ""; // limpia

    // Inyectar usando iframe sandbox aislado para evitar bloqueos del navegador y permitir
    // que el script corra inmediatamente sin esperar a otros recursos del SPA.
    const html = `<!doctype html><html><head><style>
      html,body{margin:0;padding:0;background:transparent;width:100%;height:100%;overflow:hidden;}
      iframe{display:block;margin:0 auto;border:0;}
    </style></head><body>
      <script type="text/javascript">
        atOptions = { 'key':'${adKey}','format':'iframe','height':${height},'width':${width},'params':{} };
      </script>
      <script type="text/javascript" src="https://www.highperformanceformat.com/${adKey}/invoke.js"></script>
    </body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
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
    container.appendChild(iframe);

    // Reintentos: chequear a 3s, 6s y 10s. Solo marca failed si tras 10s no hay nada.
    const timers: number[] = [];
    const check = (final: boolean) => {
      try {
        const body = iframe.contentWindow?.document?.body;
        const ok = !!body && (body.querySelector("iframe") !== null || body.innerHTML.length > 200);
        if (ok) return true;
        if (final) setFailed(true);
      } catch {
        // cross-origin → asumimos cargó
        return true;
      }
      return false;
    };
    timers.push(window.setTimeout(() => check(false), 3000));
    timers.push(window.setTimeout(() => check(false), 6000));
    timers.push(window.setTimeout(() => check(true), 10000));

    return () => { timers.forEach(clearTimeout); };
  }, [adKey, width, height, canBootAds]);

  if (isPremium) return <div aria-hidden className="w-0 h-0 overflow-hidden" />;
  if (failed) return null;

  return (
    <div className="flex flex-col items-center my-4">
      <span className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1.5">Patrocinado</span>
      <div
        ref={ref}
        id={`ad-container-${uid}`}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="bg-secondary/30 border border-border rounded-lg overflow-hidden flex items-center justify-center"
      />
    </div>
  );
}
