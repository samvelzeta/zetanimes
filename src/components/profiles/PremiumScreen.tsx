import { useEffect, useState } from "react";
import { Crown, Check, Loader2, X, ExternalLink, CreditCard, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

export default function PremiumScreen({ onClose }: Props) {
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [settings, setSettings] = useState<PremiumSettings | null>(null);
  const [selected, setSelected] = useState<PremiumPlan | null>(null);
  const [step, setStep] = useState<"plans" | "checkout">("plans");
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      listPremiumPlans(),
      getPremiumSettings(),
      supabase.from("admin_payment_info").select("*").limit(1).maybeSingle(),
    ]).then(([p, s, pi]) => {
      setPlans(p);
      setSettings(s);
      setPaymentInfo(pi.data);
      if (p.length === 1) setSelected(p[0]);
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
        await supabase.storage.from("premium-proofs").upload(path, compressed, { contentType: "image/webp" });
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
    } catch (e) {
      toast.error("Error al enviar solicitud");
    } finally {
      setSubmitting(false);
    }
  };

  const goCheckout = (plan: PremiumPlan) => {
    setSelected(plan);
    // Stripe directo
    if (settings?.stripe_enabled && settings.stripe_payment_url) {
      window.open(settings.stripe_payment_url, "_blank", "noopener");
    }
    setStep("checkout");
  };

  const characterUrl = settings?.character_image_url || null;
  const bgUrl = settings?.background_image_url || null;

  return (
    <div className="fixed inset-0 z-[120] bg-background/98 backdrop-blur-2xl flex flex-col overflow-y-auto animate-fade-in">
      {/* Background image opcional */}
      {bgUrl && (
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{ backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-4 md:p-6 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          <h1 className="text-lg md:text-xl font-black text-foreground">
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

      {/* Body — layout lateral PC, stacked móvil */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,420px)] gap-6 p-4 md:p-8 max-w-7xl w-full mx-auto">
        {/* Plans area (left on PC) */}
        <div className="space-y-5 order-2 lg:order-1">
          {step === "plans" ? (
            <>
              <div>
                <h2 className="text-2xl md:text-4xl font-black tracking-tight mb-2">
                  {settings?.subtitle || "Disfruta sin límites"}
                </h2>
                <p className="text-sm md:text-base text-muted-foreground">
                  {settings?.description || "Elige el plan que más te convenga. Cancela cuando quieras."}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {plans.length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    No hay planes activos por ahora.
                  </div>
                )}
                {plans.map((plan) => {
                  const accent = plan.accent_color || "hsl(var(--primary))";
                  return (
                    <div
                      key={plan.id}
                      className="relative rounded-2xl border-2 p-4 md:p-5 bg-card/80 backdrop-blur transition hover:scale-[1.02]"
                      style={{ borderColor: accent + "55", boxShadow: `0 0 24px ${accent}22` }}
                    >
                      {plan.badge && (
                        <span
                          className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white"
                          style={{ background: accent }}
                        >
                          {plan.badge}
                        </span>
                      )}
                      <h3 className="text-lg font-black mb-1">{plan.name}</h3>
                      <p className="text-2xl font-black mb-3" style={{ color: accent }}>
                        {plan.price_label}
                      </p>
                      <ul className="space-y-1.5 mb-4 text-sm">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: accent }} />
                            <span className="text-foreground/90">{f}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => goCheckout(plan)}
                        className="w-full py-2.5 rounded-xl font-black text-sm text-white transition hover:opacity-90"
                        style={{ background: accent }}
                      >
                        Elegir {plan.name}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <CheckoutPanel
              selected={selected!}
              settings={settings}
              paymentInfo={paymentInfo}
              notes={notes}
              setNotes={setNotes}
              proofFile={proofFile}
              proofPreview={proofPreview}
              handleProof={handleProof}
              submitting={submitting}
              onBack={() => setStep("plans")}
              onSubmit={submitRequest}
            />
          )}
        </div>

        {/* Character (right on PC, top on mobile) */}
        <div className="order-1 lg:order-2 flex items-end justify-center lg:items-center pointer-events-none select-none">
          {characterUrl ? (
            <img
              src={characterUrl}
              alt=""
              className="max-h-[50vh] lg:max-h-[80vh] w-auto object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
              style={{ filter: "drop-shadow(0 0 30px hsl(var(--primary) / 0.35))" }}
            />
          ) : (
            <div className="hidden lg:flex w-full h-[60vh] rounded-3xl border-2 border-dashed border-border items-center justify-center text-muted-foreground text-xs px-6 text-center">
              El admin puede subir aquí una imagen del personaje desde el panel
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckoutPanel({
  selected, settings, paymentInfo, notes, setNotes, proofFile, proofPreview, handleProof, submitting, onBack, onSubmit,
}: any) {
  const hasStripe = settings?.stripe_enabled && settings?.stripe_payment_url;
  const hasAlt = !!settings?.alt_payment_url;
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
        ← Cambiar de plan
      </button>

      <div className="rounded-2xl border-2 border-primary/40 p-4 bg-primary/5">
        <p className="text-[10px] uppercase tracking-wider text-primary font-black">Plan elegido</p>
        <h3 className="text-xl font-black">{selected.name}</h3>
        <p className="text-lg font-black text-primary">{selected.price_label}</p>
      </div>

      {(hasStripe || hasAlt) && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-foreground">Paga online y te activamos automáticamente:</p>
          {hasStripe && (
            <a
              href={settings.stripe_payment_url}
              target="_blank"
              rel="noopener"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-black text-sm hover:opacity-90 transition"
            >
              <CreditCard className="w-4 h-4" /> Pagar con tarjeta (Stripe)
            </a>
          )}
          {hasAlt && (
            <a
              href={settings.alt_payment_url}
              target="_blank"
              rel="noopener"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary border border-border text-foreground font-bold text-sm hover:border-primary transition"
            >
              <ExternalLink className="w-4 h-4" /> Otro método de pago
            </a>
          )}
        </div>
      )}

      {settings?.show_proof_form !== false && (
        <>
          <div className="rounded-2xl border border-border p-4 bg-secondary/40">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-black mb-2">
              ¿Pagaste por transferencia? Sube tu comprobante
            </p>
            {paymentInfo && (
              <div className="text-[11px] text-muted-foreground space-y-0.5 mb-3">
                <p><strong className="text-foreground">{paymentInfo.bank_name}</strong> · {paymentInfo.account_holder}</p>
                <p>{paymentInfo.account_number}</p>
                {paymentInfo.instructions && <p className="text-primary">{paymentInfo.instructions}</p>}
              </div>
            )}
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border-2 border-dashed border-border hover:border-primary cursor-pointer transition text-xs">
              <Upload className="w-3.5 h-3.5" /> {proofFile ? proofFile.name.slice(0, 30) : "Subir comprobante"}
              <input type="file" accept="image/*" onChange={handleProof} className="hidden" />
            </label>
            {proofPreview && (
              <img src={proofPreview} className="w-full h-32 object-contain mt-2 rounded-lg border border-border" alt="" />
            )}
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas para el admin (opcional)"
            className="w-full h-20 bg-secondary border border-border rounded-xl p-3 text-sm resize-none"
          />

          <button
            onClick={onSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Enviar solicitud
          </button>
        </>
      )}
    </div>
  );
}
