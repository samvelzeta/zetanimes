// Modal de suscripción ZetAnime — 3 planes con pago vía Ko-fi.
// El webhook de Make.com activa automáticamente la membresía al recibir el pago.
import { Crown, Check, X, ExternalLink, Sparkles } from "lucide-react";
import { useEffect } from "react";

interface Props {
  onClose: () => void;
}

const KOFI_URL = "https://ko-fi.com/zetanimes";

interface Plan {
  slug: "basico" | "solo" | "duo";
  name: string;
  price: string;
  accent: string;
  badge?: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    slug: "basico",
    name: "Básico",
    price: "$5/año",
    accent: "#22C55E",
    features: [
      "Sin anuncios",
      "Calidad Full HD",
      "1 dispositivo simultáneo",
      "2 perfiles por cuenta",
    ],
  },
  {
    slug: "solo",
    name: "Plan Solo",
    price: "$8/año",
    accent: "#3B82F6",
    badge: "Popular",
    features: [
      "Todo lo del Básico",
      "2 dispositivos simultáneos",
      "3 perfiles por cuenta",
      "Servidores prioritarios",
      "Descargas y export PDF",
    ],
  },
  {
    slug: "duo",
    name: "Plan Dúo",
    price: "$10/año",
    accent: "#A855F7",
    badge: "Mejor valor",
    features: [
      "Todo lo del Solo",
      "Calidad 4K",
      "3 dispositivos simultáneos",
      "5 perfiles por cuenta",
      "Soporte VIP prioritario",
    ],
  },
];

export default function PremiumScreen({ onClose }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const openKofi = () => {
    window.open(KOFI_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[120] bg-background/95 backdrop-blur-xl flex flex-col overflow-y-auto">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary pointer-events-none" />
      <div
        className="pointer-events-none absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)/.5), transparent 70%)" }}
      />

      <div className="relative z-20 flex items-center justify-between px-4 md:px-8 py-4 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/40">
            <Crown className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground tracking-tight leading-none">
              ZetAnime Premium
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">Membresía oficial · Pago vía Ko-fi</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-secondary hover:bg-muted flex items-center justify-center transition hover:rotate-90"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="relative z-10 flex-1 px-4 md:px-8 py-8 max-w-6xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 mb-3">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-wider text-primary">
              Planes anuales
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground leading-tight">
            Elige tu plan
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Paga una sola vez al año vía Ko-fi y disfruta sin límites. Se activa automáticamente en minutos.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.slug}
              className="group relative rounded-2xl border-2 p-5 pt-7 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
              style={{
                borderColor: plan.accent + "55",
                boxShadow: `0 12px 32px ${plan.accent}22`,
              }}
            >
              {plan.badge && (
                <span
                  className="absolute top-0 right-4 -translate-y-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-lg z-10"
                  style={{ background: plan.accent, boxShadow: `0 4px 12px ${plan.accent}88` }}
                >
                  {plan.badge}
                </span>
              )}
              <h3 className="text-lg font-black mb-1 text-foreground">{plan.name}</h3>
              <p className="text-3xl font-black mb-4" style={{ color: plan.accent }}>
                {plan.price}
              </p>
              <ul className="space-y-2 mb-5 text-[13px]">
                {plan.features.map((f, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      style={{ color: plan.accent }}
                    />
                    <span className="text-foreground/90 leading-snug">{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={openKofi}
                className="w-full py-3 rounded-xl font-black text-sm text-white transition hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: plan.accent, boxShadow: `0 6px 18px ${plan.accent}66` }}
              >
                Pagar con Ko-fi
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 rounded-xl bg-secondary/60 border border-border max-w-2xl mx-auto text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Importante:</strong> al pagar en Ko-fi usa el mismo email
            con el que te registraste en ZetAnime. La activación es automática en pocos minutos. Si tarda,
            contáctanos.
          </p>
        </div>
      </div>
    </div>
  );
}
