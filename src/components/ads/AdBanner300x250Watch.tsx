// Banner 300x250 específico para la página Watch (debajo de los controles del player).
// Usa key distinto al del Home para evitar colisiones del script de Adsterra.
import { useEffect, useRef, useState, forwardRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

const AD_KEY = "b411f21fa26a4e8427eb13433959b4e8";

const AdBanner300x250Watch = forwardRef<HTMLDivElement>((_, _outerRef) => {
  const ref = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);
  const { isPremium } = useAuth();
  const [filled, setFilled] = useState<boolean | null>(null);

  useEffect(() => {
    if (isPremium) return;
    if (loaded.current || !ref.current) return;
    loaded.current = true;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "width:300px;height:250px;border:0;display:block;";
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox");
    ref.current.appendChild(iframe);

    setTimeout(() => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><style>body{margin:0;padding:0;background:transparent;}</style></head><body>
          <script type="text/javascript">
            atOptions = { 'key':'${AD_KEY}', 'format':'iframe', 'height':250, 'width':300, 'params':{} };
          </script>
          <script type="text/javascript" src="https://www.highperformanceformat.com/${AD_KEY}/invoke.js"></script>
        </body></html>`);
        doc.close();
      } catch {}
    }, 50);

    // Verifica después de 4s si se llenó
    const check = setTimeout(() => {
      try {
        const doc = iframe.contentDocument;
        const hasContent = !!doc?.body && doc.body.innerHTML.length > 200;
        setFilled(hasContent);
      } catch {
        setFilled(true); // cross-origin = probablemente cargó
      }
    }, 4000);

    return () => clearTimeout(check);
  }, [isPremium]);

  if (isPremium) return <div aria-hidden className="w-0 h-0 overflow-hidden" />;
  if (filled === false) return null;

  return (
    <div className="flex flex-col items-center my-4">
      <span className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1.5">Patrocinado</span>
      <div ref={ref} className="w-[300px] h-[250px] bg-secondary/30 border border-border rounded-lg overflow-hidden" />
    </div>
  );
});
AdBanner300x250Watch.displayName = "AdBanner300x250Watch";
export default AdBanner300x250Watch;
