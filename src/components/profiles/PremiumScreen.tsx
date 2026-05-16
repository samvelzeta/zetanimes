import { useEffect, useRef, useState } from "react";
import { Crown, Check, Loader2, X, ExternalLink, CreditCard, Upload, ArrowLeft, ChevronRight } from "lucide-react";
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
  const [settings, setSettings] = useState<PremiumSettings | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [selected, setSelected] = useState<PremiumPlan | null>(null);
  const [step, setStep] = useState<Step>("plans");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      listPremiumPlans(),
      getPremiumSettings(),
      supabase.from("admin_payment_info").select("*").limit(1).maybeSingle(),
    ]).then(([p, s, pi]) => {
      setPlans(p);
      setSettings(s);
      setPaymentInfo(pi.data);
    });
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

  const pickPlan = (p: PremiumPlan) => {
    setSelected(p);
    setStep("method");
  };

  const goStripe = () => {
    if (settings?.stripe_payment_url) {
      window.open(settings.stripe_payment_url, "_blank", "noopener");
    } else {
      toast.error("Stripe aún no está configurado por el admin");
    }
  };

  const characterUrl = settings?.character_image_url || null;
  const bgUrl = settings?.background_image_url || null;
  const hasStripe = !!(settings?.stripe_enabled && settings?.stripe_payment_url);
  const hasAlt = !!settings?.alt_payment_url;

  // ---------- Layout helpers ----------
  // PC (lg+): split lateral con animación de slide entre paneles
  // APK / Mobile: stacked tipo "card blanca" (referencia)

  return (
    <div className="fixed inset-0 z-[120] bg-background flex flex-col overflow-hidden animate-fade-in">
      {/* Fondo opaco — sin transparencia hacia la página */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary" />
      {bgUrl && (
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{ backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-background/70 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-4 md:p-6 border-b border-border/40 bg-background/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          <h1 className="text-lg md:text-xl font-black text-foreground tracking-tight">
            {settings?.title || "ZetAnime Premium"}
          </h1>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-secondary hover:bg-muted flex items-center justify-center transition"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* === MOBILE / APK LAYOUT === */}
      {isMobile ? (
        <div className="relative z-10 flex-1 overflow-y-auto">
          {/* Hero personaje arriba */}
          <div className="relative h-[42vh] w-full overflow-hidden">
            {characterUrl ? (
              <img
                src={characterUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-top"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          </div>

          {/* Card blanca/oscura sobre el personaje (estilo referencia) */}
          <div className="relative -mt-10 px-4 pb-32 space-y-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-foreground">
                {settings?.subtitle || "Disfruta sin límites"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {settings?.description || "Elige tu plan ideal"}
              </p>
            </div>

            {step === "plans" && (
              <div className="space-y-3 animate-fade-in">
                {plans.map((plan) => {
                  const accent = plan.accent_color || "hsl(var(--primary))";
                  return (
                    <button
                      key={plan.id}
                      onClick={() => pickPlan(plan)}
                      className="w-full text-left rounded-2xl bg-card border border-border p-4 transition active:scale-[0.98] hover:border-primary"
                      style={{ boxShadow: `0 8px 24px ${accent}15` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-black text-foreground">{plan.name}</h3>
                            {plan.badge && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white"
                                style={{ background: accent }}
                              >
                                {plan.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-lg font-black mb-2" style={{ color: accent }}>
                            {plan.price_label}
                          </p>
                          <ul className="space-y-1">
                            {plan.features.slice(0, 4).map((f, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/80">
                                <Check className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: accent }} />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  );
                })}
                {plans.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No hay planes activos
                  </p>
                )}
              </div>
            )}

            {step === "method" && selected && (
              <MethodPanel
                selected={selected}
                hasStripe={hasStripe}
                hasAlt={hasAlt}
                settings={settings}
                onBack={() => setStep("plans")}
                onStripe={goStripe}
                onManual={() => setStep("manual")}
              />
            )}

            {step === "manual" && selected && (
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
            )}
          </div>
        </div>
      ) : (
        // === PC LAYOUT con animación slide ===
        <div className="relative z-10 flex-1 grid grid-cols-[1fr_minmax(320px,500px)] gap-8 p-8 max-w-[1400px] w-full mx-auto overflow-hidden">
          {/* Panel izquierdo — contenido cambia con slide */}
          <div className="relative overflow-hidden">
            <div
              key={step}
              className={
                step === "plans"
                  ? "animate-[slide-in-left_0.45s_cubic-bezier(0.16,1,0.3,1)] h-full overflow-y-auto pr-2"
                  : "animate-[slide-in-left_0.45s_cubic-bezier(0.16,1,0.3,1)] h-full overflow-y-auto pr-2"
              }
              style={{ animation: "slideInLeft 0.45s cubic-bezier(0.16,1,0.3,1)" }}
            >
              {step === "plans" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-4xl xl:text-5xl font-black tracking-tight text-foreground leading-[1.05]">
                      {settings?.subtitle || "Disfruta sin límites"}
                    </h2>
                    <p className="text-base text-muted-foreground mt-3 max-w-md">
                      {settings?.description || "Beneficios reales, sin promesas vacías"}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {plans.map((plan) => {
                      const accent = plan.accent_color || "hsl(var(--primary))";
                      return (
                        <div
                          key={plan.id}
                          className="relative rounded-2xl border-2 p-5 bg-card transition hover:scale-[1.02] hover:-translate-y-1"
                          style={{ borderColor: accent + "55", boxShadow: `0 12px 32px ${accent}25` }}
                        >
                          {plan.badge && (
                            <span
                              className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white"
                              style={{ background: accent }}
                            >
                              {plan.badge}
                            </span>
                          )}
                          <h3 className="text-xl font-black mb-1 text-foreground">{plan.name}</h3>
                          <p className="text-3xl font-black mb-4" style={{ color: accent }}>
                            {plan.price_label}
                          </p>
                          <ul className="space-y-2 mb-5 text-sm">
                            {plan.features.map((f, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: accent }} />
                                <span className="text-foreground/90">{f}</span>
                              </li>
                            ))}
                          </ul>
                          <button
                            onClick={() => pickPlan(plan)}
                            className="w-full py-3 rounded-xl font-black text-sm text-white transition hover:opacity-90 hover:shadow-lg"
                            style={{ background: accent, boxShadow: `0 8px 24px ${accent}55` }}
                          >
                            Elegir {plan.name}
                          </button>
                        </div>
                      );
                    })}
                    {plans.length === 0 && (
                      <p className="col-span-full text-center text-muted-foreground py-12">
                        No hay planes activos por ahora
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === "method" && selected && (
                <MethodPanel
                  selected={selected}
                  hasStripe={hasStripe}
                  hasAlt={hasAlt}
                  settings={settings}
                  onBack={() => setStep("plans")}
                  onStripe={goStripe}
                  onManual={() => setStep("manual")}
                />
              )}

              {step === "manual" && selected && (
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
              )}
            </div>
          </div>

          {/* Panel derecho — personaje, sale a la derecha cuando se elige plan */}
          <div className="relative overflow-hidden flex items-center justify-center pointer-events-none">
            <div
              key={`char-${step}`}
              className="w-full h-full flex items-center justify-center"
              style={{ animation: "slideInRight 0.5s cubic-bezier(0.16,1,0.3,1)" }}
            >
              {characterUrl ? (
                <img
                  src={characterUrl}
                  alt=""
                  className="max-h-[80vh] w-auto object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
                  style={{ filter: "drop-shadow(0 0 40px hsl(var(--primary) / 0.4))" }}
                />
              ) : (
                <div className="w-full h-[60vh] rounded-3xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-xs px-6 text-center">
                  El admin puede subir aquí una imagen del personaje
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ---------- Step: elegir método ----------
function MethodPanel({ selected, hasStripe, hasAlt, settings, onBack, onStripe, onManual }: any) {
  const accent = selected.accent_color || "hsl(var(--primary))";
  return (
    <div className="space-y-5 max-w-xl">
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
        <ArrowLeft className="w-3.5 h-3.5" /> Cambiar de plan
      </button>

      <div
        className="rounded-2xl border-2 p-5 bg-card"
        style={{ borderColor: accent + "55", boxShadow: `0 8px 24px ${accent}25` }}
      >
        <p className="text-[10px] uppercase tracking-wider font-black" style={{ color: accent }}>Plan elegido</p>
        <h3 className="text-2xl font-black text-foreground">{selected.name}</h3>
        <p className="text-2xl font-black mt-1" style={{ color: accent }}>{selected.price_label}</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider font-black text-muted-foreground mb-3">
          Selecciona un método de pago
        </p>
        <div className="space-y-3">
          {hasStripe && (
            <button
              onClick={onStripe}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border-2 border-border hover:border-primary transition group text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-black text-foreground">Pago con tarjeta (Stripe)</p>
                <p className="text-xs text-muted-foreground">Activación automática al confirmar</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition" />
            </button>
          )}

          {hasAlt && (
            <a
              href={settings.alt_payment_url}
              target="_blank"
              rel="noopener"
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border-2 border-border hover:border-primary transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                <ExternalLink className="w-6 h-6 text-foreground" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-black text-foreground">Otro método online</p>
                <p className="text-xs text-muted-foreground">Mercado Pago, PayPal u otro</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition" />
            </a>
          )}

          {settings?.show_proof_form !== false && (
            <button
              onClick={onManual}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border-2 border-border hover:border-primary transition group text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                <Upload className="w-6 h-6 text-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-black text-foreground">Pago manual / transferencia</p>
                <p className="text-xs text-muted-foreground">Sube tu comprobante, te activamos a mano</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition" />
            </button>
          )}

          {!hasStripe && !hasAlt && settings?.show_proof_form === false && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay métodos de pago configurados todavía.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Step: subir comprobante manual ----------
function ManualPanel({
  selected, paymentInfo, proofFile, proofPreview, handleProof, notes, setNotes, submitting, onBack, onSubmit, fileRef,
}: any) {
  const accent = selected.accent_color || "hsl(var(--primary))";
  return (
    <div className="space-y-4 max-w-xl">
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
        <ArrowLeft className="w-3.5 h-3.5" /> Cambiar de método
      </button>

      <div className="rounded-2xl border-2 p-4 bg-card" style={{ borderColor: accent + "55" }}>
        <p className="text-[10px] uppercase tracking-wider font-black" style={{ color: accent }}>Plan elegido</p>
        <h3 className="text-lg font-black text-foreground">{selected.name} · {selected.price_label}</h3>
      </div>

      {paymentInfo && (
        <div className="rounded-2xl border border-border p-4 bg-secondary/60">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-black mb-2">
            Datos para transferencia
          </p>
          <div className="text-xs text-foreground/90 space-y-0.5">
            <p><strong>{paymentInfo.bank_name}</strong> · {paymentInfo.account_holder}</p>
            <p className="font-mono">{paymentInfo.account_number}</p>
            {paymentInfo.instructions && <p className="text-primary mt-1">{paymentInfo.instructions}</p>}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 px-4 py-3 rounded-xl bg-card border-2 border-dashed border-border hover:border-primary cursor-pointer transition text-sm">
        <Upload className="w-4 h-4" />
        <span className="flex-1 truncate">{proofFile ? proofFile.name : "Subir comprobante (imagen)"}</span>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleProof} className="hidden" />
      </label>
      {proofPreview && (
        <img src={proofPreview} className="w-full h-40 object-contain rounded-xl border border-border bg-black/20" alt="" />
      )}

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas para el admin (opcional)"
        className="w-full h-20 bg-card border border-border rounded-xl p-3 text-sm resize-none"
      />

      <button
        onClick={onSubmit}
        disabled={submitting || !proofFile}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:shadow-lg transition"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Enviar solicitud
      </button>
    </div>
  );
}
