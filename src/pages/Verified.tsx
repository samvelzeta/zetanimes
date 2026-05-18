import { useEffect, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import logoUrl from "@/assets/zetanime-apk-logo.png";
import { supabase } from "@/integrations/supabase/client";

const DOTS = Array.from({ length: 18 }).map((_, i) => ({
  left: (i * 53) % 100,
  top: (i * 37 + 11) % 100,
  size: 4 + ((i * 7) % 6),
  delay: (i % 9) * 0.25,
  duration: 2.4 + ((i * 0.31) % 1.8),
}));

export default function VerifiedPage() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    document.title = "Correo verificado · zetAnime";
    // Si el link traía tokens en el hash, Supabase ya creó la sesión.
    // No queremos dejar al usuario "logueado" en una pestaña aislada: nos despedimos.
    supabase.auth.signOut().catch(() => {});
    const t = setTimeout(() => setShow(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-background flex items-center justify-center px-6">
      {/* Fondo radial + puntos animados */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, hsl(16 100% 8%) 0%, hsl(0 0% 3%) 70%)" }}
      />
      {DOTS.map((d, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-primary/60 animate-pulse"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
            boxShadow: "0 0 20px hsl(var(--primary) / 0.45)",
          }}
        />
      ))}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full opacity-40 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
      />

      <div className={`relative z-10 max-w-md w-full text-center transition-all duration-700 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
        {/* Logo rayo con glow */}
        <div className="relative mx-auto mb-8 w-40 h-40">
          <div
            className="absolute inset-[-30px] rounded-full animate-pulse"
            style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.55) 0%, transparent 70%)" }}
          />
          <img
            src={logoUrl}
            alt="zetAnime"
            className="relative w-full h-full object-contain drop-shadow-[0_0_30px_hsl(var(--primary)/0.85)]"
          />
          {/* check flotante */}
          <div className="absolute -bottom-2 -right-2 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-2xl border-4 border-background animate-[scale-in_0.5s_ease-out_0.3s_both]">
            <CheckCircle2 className="w-8 h-8" strokeWidth={2.5} />
          </div>
          {/* destellitos */}
          <Sparkles className="absolute -top-2 -left-2 w-6 h-6 text-primary animate-pulse" />
          <Sparkles className="absolute top-4 -right-4 w-5 h-5 text-primary/80 animate-pulse" style={{ animationDelay: "0.6s" }} />
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mb-3 drop-shadow-lg">
          ¡Correo <span className="text-primary">verificado</span>!
        </h1>
        <p className="text-sm text-foreground/85 mb-2 max-w-sm mx-auto">
          Tu cuenta de <span className="font-bold text-primary">zetAnime</span> quedó activada correctamente.
        </p>
        <p className="text-xs text-muted-foreground mb-8">
          Ya puedes <span className="text-foreground font-semibold">cerrar esta pestaña</span> y volver a la app para iniciar sesión.
        </p>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/40 backdrop-blur-sm">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
            <span className="relative rounded-full w-2 h-2 bg-primary" />
          </span>
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Cuenta activa</span>
        </div>
      </div>
    </div>
  );
}
