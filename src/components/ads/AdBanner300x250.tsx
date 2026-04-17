import { useEffect, useRef, forwardRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Banner 300x250 Adsterra. Se inserta debajo del Top 10.
 * Premium = oculto y sin clicks.
 */
const AdBanner300x250 = forwardRef<HTMLDivElement>((_, _outerRef) => {
  const { isPremium } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (isPremium || loaded.current || !ref.current) return;
    loaded.current = true;

    const html = `
      <html><head><style>body{margin:0;background:transparent;display:flex;justify-content:center;align-items:center;}</style></head>
      <body>
        <script type="text/javascript">
          atOptions = {
            'key' : 'b411f21fa26a4e8427eb13433959b4e8',
            'format' : 'iframe',
            'height' : 250,
            'width' : 300,
            'params' : {}
          };
        </script>
        <script type="text/javascript" src="https://www.highperformanceformat.com/b411f21fa26a4e8427eb13433959b4e8/invoke.js"></script>
      </body></html>
    `;

    const iframe = document.createElement("iframe");
    iframe.style.width = "300px";
    iframe.style.height = "250px";
    iframe.style.border = "0";
    iframe.scrolling = "no";
    iframe.setAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin");
    ref.current.appendChild(iframe);
    iframe.contentWindow?.document.open();
    iframe.contentWindow?.document.write(html);
    iframe.contentWindow?.document.close();
  }, [isPremium]);

  if (isPremium) return null;

  return (
    <div className="px-4 my-6 flex justify-center">
      <div className="w-full max-w-[320px] bg-secondary rounded-xl border border-border p-2.5 shadow-lg">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Patrocinado</span>
          <span className="text-[9px] text-primary/70">Ad</span>
        </div>
        <div ref={ref} className="w-[300px] h-[250px] mx-auto overflow-hidden rounded-lg" />
      </div>
    </div>
  );
});
AdBanner300x250.displayName = "AdBanner300x250";
export default AdBanner300x250;
