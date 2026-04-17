// Ad Adsterra — patrón correcto:
// El script de Adsterra define `atOptions` y luego llama invoke.js que reemplaza el contenedor
// con el iframe del ad. Como React es SPA y los <script> JSX no se ejecutan, hay que:
// 1) Crear los <script> con document.createElement
// 2) Asignarles el atOptions ANTES del invoke.js
// 3) Appendar al body, y poner un container con el ID que invoke.js usa
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  adKey: string;
  width: number;
  height: number;
  /** Identificador único para esta instancia (evita colisiones cuando hay varios ads en la página) */
  uid: string;
}

export default function AdsterraBanner({ adKey, width, height, uid }: Props) {
  const { isPremium } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const injected = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isPremium || injected.current || !ref.current) return;
    injected.current = true;

    const container = ref.current;
    container.innerHTML = ""; // limpia

    // 1) Script de configuración (atOptions)
    const configScript = document.createElement("script");
    configScript.type = "text/javascript";
    configScript.text = `
      atOptions = {
        'key': '${adKey}',
        'format': 'iframe',
        'height': ${height},
        'width': ${width},
        'params': {}
      };
    `;
    container.appendChild(configScript);

    // 2) Script de invocación (genera el iframe del ad)
    const invokeScript = document.createElement("script");
    invokeScript.type = "text/javascript";
    invokeScript.src = `https://www.highperformanceformat.com/${adKey}/invoke.js`;
    invokeScript.async = true;
    invokeScript.onerror = () => setFailed(true);
    container.appendChild(invokeScript);

    // Verifica tras 5s si el iframe llegó. Si no, lo marca como fallido (probablemente bloqueado por adblock).
    const checkTimer = setTimeout(() => {
      const iframe = container.querySelector("iframe");
      if (!iframe) setFailed(true);
    }, 5000);

    return () => clearTimeout(checkTimer);
  }, [adKey, width, height, isPremium]);

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
