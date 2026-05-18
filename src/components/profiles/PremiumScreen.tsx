import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, Check, Loader2, X, ExternalLink, CreditCard, Upload, ArrowLeft, ChevronRight, Sparkles, Shield, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { compressProof } from "@/lib/image-compress";
import { toast } from "sonner";
import {
  listPremiumPlans,
  getPremiumSettings,
  type PremiumPlan,
  type PremiumSettings,
} from "@/lib/premium-config";

interface Props {
  onClose: () => void;
}

type Step = "plans" | "method" | "manual";

export default function PremiumScreen({ onClose }: Props) {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [settings, setSettings] = useState<(PremiumSettings & { checkout_character_image_url?: string | null; character3_image_url?: string | null; character_hover_text_1?: string | null; character_hover_text_2?: string | null; character_hover_text_3?: string | null; companion_prompt?: string | null }) | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [selected, setSelected] = useState<PremiumPlan | null>(null);
  const [step, setStep] = useState<Step>("plans");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [companion, setCompanion] = useState<1 | 2 | 3 | null>(null);
  const [hoverChar, setHoverChar] = useState<1 | 2 | 3 | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      listPremiumPlans(),
      getPremiumSettings(),
      supabase.from("admin_payment_info").select("*").limit(1).maybeSingle(),
    ]).then(([p, s, pi]) => {
      setPlans(p);
      setSettings(s as any);
      setPaymentInfo(pi.data);
      setLoaded(true);
    });
  }, []);

  // Bloquear scroll body mientras el modal está abierto (evita scroll fantasma en APK)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setProofFile(f);
    setProofPreview(URL.createObjectURL(f));
  };

  const submitRequest = async () => {
    if (!user || !selected) return;
    setSubmitting(true);
    try {
      let proofUrl = "";
      if (proofFile) {
        const compressed = await compressProof(proofFile);
        const path = `${user.id}/${Date.now()}-comprobante.webp`;
        const { error: upErr } = await supabase.storage
          .from("premium-proofs")
          .upload(path, compressed, { contentType: "image/webp", upsert: true });
        if (upErr) throw upErr;
        proofUrl = path;
      }
      await supabase.from("premium_requests").insert({
        user_id: user.id,
        username: profile?.username,
        email: user.email,
        membership_type: selected.membership_type,
        proof_url: proofUrl,
        notes: `Plan: ${selected.name} (${selected.price_label})\n${notes}`,
      });
      toast.success("Solicitud enviada. Te activaremos en cuanto se confirme el pago.");
      onClose();
    } catch (e: any) {
      toast.error("Error al enviar solicitud: " + (e.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  const pickPlan = (p: PremiumPlan) => { setSelected(p); setStep("method"); };
  const goStripe = () => {
    if (settings?.stripe_payment_url) window.open(settings.stripe_payment_url, "_blank", "noopener");
    else toast.error("Stripe aún no está configurado por el admin");
  };

  const characterUrl = settings?.character_image_url || null;
  const checkoutUrl = settings?.checkout_character_image_url || settings?.character_image_url || null;
  const character3Url = (settings as any)?.character3_image_url || checkoutUrl;
  const bgUrl = settings?.background_image_url || null;
  const hasStripe = !!(settings?.stripe_enabled && settings?.stripe_payment_url);
  const hasAlt = !!settings?.alt_payment_url;

  // Trueque: en step "plans" y "manual" imagen va a la DERECHA; en "method" imagen va a la IZQUIERDA
  const imageOnRight = step === "plans" || step === "manual";
  const currentImg = step === "plans" ? characterUrl : step === "method" ? checkoutUrl : character3Url;
  const currentHover = step === "plans"
    ? (settings as any)?.character_hover_text_1
    : step === "method" ? (settings as any)?.character_hover_text_2
    : (settings as any)?.character_hover_text_3;
  const currentCharIdx: 1 | 2 | 3 = step === "plans" ? 1 : step === "method" ? 2 : 3;

  return (
    <div className="fixed inset-0 z-[120] bg-background flex flex-col overflow-hidden">
      {/* Fondo base + degradado animado */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary" />
      {bgUrl && (
        <div
          className="absolute inset-0 opacity-55 pointer-events-none"
          style={{ backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(.5px)" }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/25 to-background/15 pointer-events-none" />

      <div className="absolute inset-0 bg-gradient-to-t from-background/45 via-background/12 to-background/8 pointer-events-none" />

      {/* Orbe decorativo animado */}
      <div className="pointer-events-none absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-30 blur-3xl animate-[pulseGlow_6s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)/.6), transparent 70%)" }} />
      <div className="pointer-events-none absolute -bottom-40 -left-32 w-[420px] h-[420px] rounded-full opacity-20 blur-3xl animate-[pulseGlow_8s_ease-in-out_infinite_reverse]"
        style={{ background: "radial-gradient(circle, hsl(var(--accent)/.6), transparent 70%)" }} />

      {/* Header */}
      <div className="relative z-20 flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border/30 bg-background/50 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/40">
            <Crown className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black text-foreground tracking-tight leading-none">
              {settings?.title || "ZetAnime Premium"}
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5 hidden md:block">Membresía oficial</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-secondary/70 hover:bg-muted backdrop-blur-sm flex items-center justify-center transition hover:scale-110 hover:rotate-90"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Skeleton inicial para evitar flash vacío */}
      {!loaded && (
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* === MOBILE / APK === */}
      {loaded && isMobile ? (
        <MobileLayout
          step={step}
          plans={plans}
          settings={settings}
          selected={selected}
          characterUrl={currentImg}
          paymentInfo={paymentInfo}
          hasStripe={hasStripe}
          hasAlt={hasAlt}
          proofFile={proofFile}
          proofPreview={proofPreview}
          notes={notes}
          submitting={submitting}
          fileRef={fileRef}
          onPick={pickPlan}
          onStripe={goStripe}
          onManual={() => setStep("manual")}
          onBackToPlans={() => setStep("plans")}
          onBackToMethod={() => setStep("method")}
          onProof={handleProof}
          onSetNotes={setNotes}
          onSubmit={submitRequest}
        />
      ) : loaded ? (
        // === PC: layout split que hace TRUEQUE ===
        <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar">
          <div className="min-h-full max-w-[1580px] mx-auto px-10 py-5 grid grid-cols-[minmax(0,1.12fr)_minmax(380px,1fr)] gap-10 items-stretch">
            {/* PANEL IZQUIERDO */}
            <div className="relative h-full overflow-visible">
              {step === "plans" ? (
                <PanelContent key="plans-left" direction="left">
                  <PlansPanel
                    settings={settings}
                    plans={plans}
                    onPick={pickPlan}
                  />
                </PanelContent>
              ) : step === "method" ? (
                <PanelContent key="img-left-method" direction="left">
                  <CharacterPanel url={currentImg} accent={selected?.accent_color} hoverText={currentHover} />
                </PanelContent>
              ) : step === "manual" && selected ? (
                <PanelContent key="manual-left" direction="left">
                  <ManualPanel
                    selected={selected}
                    paymentInfo={paymentInfo}
                    proofFile={proofFile}
                    proofPreview={proofPreview}
                    handleProof={handleProof}
                    notes={notes}
                    setNotes={setNotes}
                    submitting={submitting}
                    onBack={() => setStep("method")}
                    onSubmit={submitRequest}
                    fileRef={fileRef}
                  />
                </PanelContent>
              ) : null}
            </div>

            {/* PANEL DERECHO */}
            <div className="relative h-full overflow-visible">
              {step === "plans" || step === "manual" ? (
                <PanelContent key={`img-right-${step}`} direction="right">
                  <CharacterPanel url={currentImg} accent={selected?.accent_color} hoverText={currentHover} />
                </PanelContent>
              ) : step === "method" && selected ? (
                <PanelContent key="method-right" direction="right">
                  <MethodPanel
                    selected={selected}
                    hasStripe={hasStripe}
                    hasAlt={hasAlt}
                    settings={settings}
                    onBack={() => setStep("plans")}
                    onStripe={goStripe}
                    onManual={() => setStep("manual")}
                  />
                </PanelContent>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes swapInFromLeft {
          0% { transform: translateX(-60%) scale(.95); opacity: 0; filter: blur(8px); }
          60% { opacity: 1; filter: blur(0); }
          100% { transform: translateX(0) scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes swapInFromRight {
          0% { transform: translateX(60%) scale(.95); opacity: 0; filter: blur(8px); }
          60% { opacity: 1; filter: blur(0); }
          100% { transform: translateX(0) scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: .25; }
          50% { transform: scale(1.1); opacity: .4; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes risePop {
          0% { transform: translateY(20px) scale(.96); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .anim-rise { animation: risePop .55s cubic-bezier(0.16,1,0.3,1) backwards; }
      `}</style>
    </div>
  );
}

// ---------- Slot animado con dirección ----------
function PanelContent({ children, direction }: { children: React.ReactNode; direction: "left" | "right" }) {
  return (
    <div
      className="h-full min-h-[calc(100vh-6.5rem)] w-full overflow-visible"
      style={{ animation: `${direction === "left" ? "swapInFromLeft" : "swapInFromRight"} 0.55s cubic-bezier(0.16,1,0.3,1)` }}
    >
      {children}
    </div>
  );
}

// ---------- IMAGEN PERSONAJE (PC) ----------
function CharacterPanel({ url, accent, hoverText }: { url: string | null; accent?: string | null; hoverText?: string | null }) {
  const glow = accent || "hsl(var(--primary))";
  return (
    <div className="relative h-full w-full flex items-center justify-center group overflow-visible">
      <div
        className="absolute left-1/2 top-1/2 h-[72%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-45 blur-[90px] pointer-events-none"
        style={{ background: `radial-gradient(circle, ${glow}55 0%, ${glow}22 38%, transparent 72%)` }}
      />
      {url ? (
        <>
          <img
            src={url}
            alt=""
            className="relative max-h-[96%] max-w-[108%] w-auto h-auto object-contain transition-transform duration-500 group-hover:scale-[1.03]"
            style={{
              filter: `drop-shadow(0 30px 60px rgba(0,0,0,.7)) drop-shadow(0 0 44px ${glow}55)`,
              animation: "floatY 5s ease-in-out infinite",
            }}
          />
          {hoverText && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 max-w-[80%] px-4 py-2.5 rounded-2xl bg-card/95 backdrop-blur-md border-2 border-primary/40 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-y-2 group-hover:translate-y-0 pointer-events-none">
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-r-2 border-b-2 border-primary/40 rotate-45" />
              <p className="text-sm font-bold text-foreground text-center leading-snug italic">"{hoverText}"</p>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-3/4 rounded-3xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-xs px-6 text-center">
          El admin puede subir aquí una imagen del personaje
        </div>
      )}
    </div>
  );
}

// ---------- PANEL PLANES (PC) ----------
function PlansPanel({ settings, plans, onPick }: any) {
  return (
    <div className="h-full overflow-y-auto overflow-x-visible hide-scrollbar px-3">
      <div className="space-y-6 pb-10">
        <div className="anim-rise">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 mb-3">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-wider text-primary">Membresía oficial</span>
          </div>
          <h2 className="text-4xl xl:text-5xl font-black tracking-tight text-foreground leading-[1.05]">
            {settings?.subtitle || "Disfruta sin límites"}
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-md">
            {settings?.description || "Beneficios reales, sin promesas vacías"}
          </p>
        </div>

        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 pt-4 pb-3 overflow-visible">
          {plans.map((plan: PremiumPlan, i: number) => {
            const accent = plan.accent_color || "hsl(var(--primary))";
            return (
              <button
                key={plan.id}
                onClick={() => onPick(plan)}
                className="group relative text-left rounded-2xl border-2 p-4 pt-7 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:scale-[1.025] hover:-translate-y-1 anim-rise overflow-visible z-0 hover:z-20"
                style={{
                  borderColor: accent + "55",
                  boxShadow: `0 12px 32px ${accent}22`,
                  animationDelay: `${0.1 + i * 0.08}s`,
                }}
              >
                {/* shimmer en hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition pointer-events-none"
                  style={{ background: `linear-gradient(90deg, transparent, ${accent}22, transparent)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s linear infinite" }} />
                {plan.badge && (
                  <span
                    className="absolute top-0 right-4 -translate-y-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-lg z-10 whitespace-nowrap"
                    style={{ background: accent, boxShadow: `0 4px 12px ${accent}88` }}
                  >
                    {plan.badge}
                  </span>
                )}
                <h3 className="text-base font-black mb-1 text-foreground">{plan.name}</h3>
                <p className="text-2xl font-black mb-3" style={{ color: accent }}>{plan.price_label}</p>
                <ul className="space-y-1.5 mb-4 text-[12px]">
                  {plan.features.slice(0, 5).map((f: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: accent }} />
                      <span className="text-foreground/85 leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
                <div
                  className="w-full py-2.5 rounded-xl font-black text-xs text-white flex items-center justify-center gap-1.5 transition group-hover:gap-2.5"
                  style={{ background: accent, boxShadow: `0 8px 24px ${accent}55` }}
                >
                  Elegir {plan.name} <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
          {plans.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-12">No hay planes activos por ahora</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- MOBILE LAYOUT ----------
function MobileLayout({
  step, plans, settings, selected, characterUrl, paymentInfo, hasStripe, hasAlt,
  proofFile, proofPreview, notes, submitting, fileRef,
  onPick, onStripe, onManual, onBackToPlans, onBackToMethod, onProof, onSetNotes, onSubmit,
}: any) {
  return (
    <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
      {/* Hero personaje arriba — fijo, recortado en la línea inferior del personaje */}
      <div className="relative h-[32vh] flex-shrink-0 overflow-hidden">
        {characterUrl ? (
          <img
            key={characterUrl}
            src={characterUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-top"
            style={{ animation: "swapInFromLeft .5s cubic-bezier(0.16,1,0.3,1)" }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30" />
        )}
        {/* Fade suave (reducido) hacia el contenido */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 via-background/30 to-transparent" />
        {/* Halo decorativo */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-2/3 h-24 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)/.6), transparent 70%)" }} />
      </div>

      {/* Contenido scrollable — empieza JUSTO debajo de la línea del personaje */}
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden px-4 pt-3 pb-8 space-y-4">
        {/* Título */}
        <div className="anim-rise">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 mb-2">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[9px] font-black uppercase tracking-wider text-primary">Premium</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground leading-tight">
            {settings?.subtitle || "Disfruta sin límites"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {settings?.description || "Elige tu plan ideal"}
          </p>
        </div>

        {step === "plans" && (
          <div className="space-y-4 pt-2">
            {plans.map((plan: PremiumPlan, i: number) => {
              const accent = plan.accent_color || "hsl(var(--primary))";
              return (
                <PlanCardMobile
                  key={plan.id}
                  plan={plan}
                  accent={accent}
                  index={i}
                  onPick={onPick}
                />
              );
            })}
            {plans.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">No hay planes activos</p>
            )}
          </div>
        )}

        {step === "method" && selected && (
          <div className="anim-rise">
            <MethodPanel
              selected={selected}
              hasStripe={hasStripe}
              hasAlt={hasAlt}
              settings={settings}
              onBack={onBackToPlans}
              onStripe={onStripe}
              onManual={onManual}
              compact
            />
          </div>
        )}

        {step === "manual" && selected && (
          <div className="anim-rise">
            <ManualPanel
              selected={selected}
              paymentInfo={paymentInfo}
              proofFile={proofFile}
              proofPreview={proofPreview}
              handleProof={onProof}
              notes={notes}
              setNotes={onSetNotes}
              submitting={submitting}
              onBack={onBackToMethod}
              onSubmit={onSubmit}
              fileRef={fileRef}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- PLAN CARD MOBILE (con badge visible y features desplegables) ----------
function PlanCardMobile({ plan, accent, index, onPick }: { plan: PremiumPlan; accent: string; index: number; onPick: (p: PremiumPlan) => void }) {
  const [expanded, setExpanded] = useState(false);
  const visibleCount = expanded ? plan.features.length : 3;
  const extra = plan.features.length - 3;
  return (
    <div className="relative overflow-visible" style={{ zIndex: 1 }}>
      {plan.badge && (
        <span
          className="absolute -top-2 right-3 z-30 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white shadow-lg pointer-events-none whitespace-nowrap"
          style={{ background: accent, boxShadow: `0 4px 12px ${accent}88` }}
        >
          {plan.badge}
        </span>
      )}
      <button
        onClick={() => onPick(plan)}
        className="group w-full text-left rounded-2xl bg-card/90 backdrop-blur-sm border-2 p-4 transition active:scale-[0.98] anim-rise relative overflow-visible"
        style={{
          borderColor: accent + "44",
          boxShadow: `0 10px 28px ${accent}1f`,
          animationDelay: `${0.05 + index * 0.07}s`,
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-foreground truncate">{plan.name}</h3>
            <p className="text-2xl font-black mt-0.5 mb-2" style={{ color: accent }}>{plan.price_label}</p>
            <ul className="space-y-1">
              {plan.features.slice(0, visibleCount).map((f: string, idx: number) => (
                <li key={idx} className="flex items-start gap-1.5 text-[11px] text-foreground/85">
                  <Check className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: accent }} />
                  <span className="leading-snug">{f}</span>
                </li>
              ))}
              {extra > 0 && (
                <li>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); setExpanded((v) => !v); } }}
                    className="inline-block mt-1 text-[10px] font-bold underline-offset-2 hover:underline cursor-pointer"
                    style={{ color: accent }}
                  >
                    {expanded ? "Ver menos ▲" : `+${extra} más ▼`}
                  </span>
                </li>
              )}
            </ul>
          </div>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition group-active:scale-90"
            style={{ background: accent, boxShadow: `0 6px 16px ${accent}66` }}
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </div>
        </div>
      </button>
    </div>
  );
}
function MethodPanel({ selected, hasStripe, hasAlt, settings, onBack, onStripe, onManual, compact }: any) {
  const accent = selected.accent_color || "hsl(var(--primary))";
  return (
    <div className={`h-full overflow-y-auto overflow-x-visible hide-scrollbar px-3`}>
      <div className="space-y-4 max-w-xl pb-8 pt-2">
        {/* Botón cambiar plan — animado */}
        <button
          onClick={onBack}
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/80 hover:bg-secondary border border-border hover:border-primary transition-all text-xs font-bold text-foreground hover:gap-3 hover:pl-3"
        >
          <span className="w-5 h-5 rounded-full bg-background flex items-center justify-center transition group-hover:-translate-x-0.5">
            <ArrowLeft className="w-3 h-3" />
          </span>
          Cambiar plan
        </button>

        {/* Plan elegido — card animada */}
        <div
          className="relative rounded-2xl border-2 p-5 bg-card/90 backdrop-blur-sm overflow-hidden"
          style={{ borderColor: accent + "66", boxShadow: `0 12px 32px ${accent}25` }}
        >
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-30 blur-2xl" style={{ background: accent }} />
          <p className="relative text-[10px] uppercase tracking-wider font-black" style={{ color: accent }}>Plan elegido</p>
          <h3 className="relative text-2xl font-black text-foreground mt-1">{selected.name}</h3>
          <p className="relative text-3xl font-black mt-1" style={{ color: accent }}>{selected.price_label}</p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider font-black text-muted-foreground mb-3 flex items-center gap-1.5">
            <Shield className="w-3 h-3" /> Selecciona un método
          </p>
          <div className="space-y-2.5">
            {hasStripe && (
              <MethodButton
                onClick={onStripe}
                icon={<CreditCard className="w-5 h-5 text-white" />}
                iconBg="bg-gradient-to-br from-primary to-accent"
                title="Pago con tarjeta"
                subtitle="Stripe · activación automática"
                accent={accent}
              />
            )}
            {hasAlt && (
              <a href={settings.alt_payment_url} target="_blank" rel="noopener" className="block">
                <MethodButton
                  icon={<ExternalLink className="w-5 h-5 text-foreground" />}
                  iconBg="bg-secondary"
                  title="Otro método online"
                  subtitle="Mercado Pago, PayPal u otro"
                  accent={accent}
                />
              </a>
            )}
            {settings?.show_proof_form !== false && (
              <MethodButton
                onClick={onManual}
                icon={<Upload className="w-5 h-5 text-foreground" />}
                iconBg="bg-secondary"
                title="Pago manual / transferencia"
                subtitle="Sube tu comprobante, te activamos a mano"
                accent={accent}
              />
            )}
            {!hasStripe && !hasAlt && settings?.show_proof_form === false && (
              <p className="text-sm text-muted-foreground text-center py-6">No hay métodos de pago configurados todavía.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MethodButton({ onClick, icon, iconBg, title, subtitle, accent }: any) {
  const Cmp: any = onClick ? "button" : "div";
  return (
    <Cmp
      onClick={onClick}
      className="group w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card/90 backdrop-blur-sm border-2 border-border hover:border-primary transition-all text-left hover:scale-[1.015] active:scale-[0.99] overflow-visible"
      style={{ boxShadow: `0 6px 16px ${accent}15` }}
    >
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0 shadow-md`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-foreground text-sm">{title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition flex-shrink-0" />
    </Cmp>
  );
}

// ---------- Step: subir comprobante manual ----------
function ManualPanel({
  selected, paymentInfo, proofFile, proofPreview, handleProof, notes, setNotes, submitting, onBack, onSubmit, fileRef, compact,
}: any) {
  const accent = selected.accent_color || "hsl(var(--primary))";
  return (
    <div className="h-full overflow-y-auto overflow-x-visible hide-scrollbar px-3">
      <div className="space-y-3.5 max-w-xl pb-8 pt-2">
        <button
          onClick={onBack}
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/80 hover:bg-secondary border border-border hover:border-primary transition text-xs font-bold"
        >
          <span className="w-5 h-5 rounded-full bg-background flex items-center justify-center transition group-hover:-translate-x-0.5">
            <ArrowLeft className="w-3 h-3" />
          </span>
          Cambiar método
        </button>

        <div className="rounded-2xl border-2 p-4 bg-card/90 backdrop-blur-sm" style={{ borderColor: accent + "55" }}>
          <p className="text-[10px] uppercase tracking-wider font-black" style={{ color: accent }}>Plan elegido</p>
          <h3 className="text-base font-black text-foreground mt-0.5">{selected.name} · <span style={{ color: accent }}>{selected.price_label}</span></h3>
        </div>

        {paymentInfo && (
          <div className="rounded-2xl border border-border p-4 bg-secondary/60 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-black mb-2 flex items-center gap-1"><Zap className="w-3 h-3 text-primary" /> Datos para transferencia</p>
            <div className="text-xs text-foreground/90 space-y-0.5">
              <p><strong>{paymentInfo.bank_name}</strong> · {paymentInfo.account_holder}</p>
              <p className="font-mono break-all">{paymentInfo.account_number}</p>
              {paymentInfo.instructions && <p className="text-primary mt-1.5 text-[11px]">{paymentInfo.instructions}</p>}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-card/90 backdrop-blur-sm border-2 border-dashed border-border hover:border-primary cursor-pointer transition text-sm hover:scale-[1.01]">
          <Upload className="w-4 h-4 text-primary" />
          <span className="flex-1 truncate text-foreground">{proofFile ? proofFile.name : "Subir comprobante"}</span>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleProof} className="hidden" />
        </label>
        {proofPreview && (
          <img src={proofPreview} className="w-full max-h-40 object-contain rounded-xl border border-border bg-black/20" alt="" />
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas para el admin (opcional)"
          className="w-full h-16 bg-card/90 backdrop-blur-sm border border-border rounded-xl p-3 text-xs resize-none focus:border-primary outline-none transition"
        />

        <button
          onClick={onSubmit}
          disabled={submitting || !proofFile}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-primary/40 transition hover:scale-[1.02] active:scale-[0.99]"
          style={{ animation: !submitting && proofFile ? "shimmer 3s linear infinite" : undefined }}
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Enviar solicitud
        </button>
      </div>
    </div>
  );
}
