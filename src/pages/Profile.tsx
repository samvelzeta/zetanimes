import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Settings, LogOut, Crown, Shield, MessageSquare, ExternalLink, Camera, Share2, Smartphone, Cog, ChevronRight, Library, FileDown, Sparkles, Palette, Users, KeyRound, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { compressAvatar, compressProof } from "@/lib/image-compress";
import { Loader2 } from "lucide-react";
import { exportUserHistoryToPDF } from "@/lib/export-history-pdf";
import { getAccentColor } from "@/lib/accent";
import ProfileManagementSection from "@/components/profiles/ProfileManagementSection";

export default function Profile() {
  const { user, profile, isPremium, isOwner, isAdmin, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState({ lists: 0, episodes: 0, hours: 0 });
  const [contacts, setContacts] = useState<any[]>([]);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPDF = async () => {
    if (!user || !profile) return;
    setExportingPdf(true);
    try {
      await exportUserHistoryToPDF(user.id, {
        username: profile.username,
        displayName: profile.display_name || profile.username,
        accentHex: getAccentColor().hex,
      });
      toast.success("Historial exportado");
    } catch (e) {
      console.error(e);
      toast.error("Error al generar PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  // Auto-abrir modal premium si viene con ?premium=1 (ej: desde AdblockGate)
  useEffect(() => {
    if (searchParams.get("premium") === "1" && user && !isPremium) {
      setShowPremiumModal(true);
      searchParams.delete("premium");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, user, isPremium, setSearchParams]);

  useEffect(() => {
    if (user) loadStats();
    loadContacts();
  }, [user]);

  const loadStats = async () => {
    if (!user) return;
    const [{ count: lists }, { count: episodes }, { data: historyData }] = await Promise.all([
      supabase.from("anime_lists").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("watch_history").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("completed", true),
      supabase.from("watch_history").select("watch_duration_seconds").eq("user_id", user.id),
    ]);
    const totalSeconds = historyData?.reduce((acc, h) => acc + (h.watch_duration_seconds || 0), 0) || 0;
    setStats({ lists: lists || 0, episodes: episodes || 0, hours: Math.round((totalSeconds / 3600) * 10) / 10 });
  };

  const loadContacts = async () => {
    const { data } = await supabase.from("contact_links").select("*").order("sort_order");
    if (data) setContacts(data);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const compressed = await compressAvatar(file);
    const path = `${user.id}/avatar.webp`;
    const { error } = await supabase.storage.from("avatars").upload(path, compressed, { upsert: true, contentType: "image/webp" });
    if (error) return toast.error("Error al subir imagen");
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: `${urlData.publicUrl}?t=${Date.now()}` }).eq("user_id", user.id);
    await refreshProfile();
    toast.success("Foto actualizada");
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-12 px-4 pb-24">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-24 h-24 rounded-full overflow-hidden mb-3 ring-1 ring-border">
            <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-2xl font-black text-primary-foreground">Z</span>
            </div>
          </div>
          <h1 className="text-lg font-black text-foreground">Invitado</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Inicia sesión para guardar tu progreso</p>
          <Link to="/auth" className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition">
            Iniciar Sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-12 px-4 pb-24">
      {/* Header avatar — limpio, sin tuercas decorativas de fondo */}
      <div className="flex flex-col items-center text-center mb-6 relative">
        <div className="relative">
          {/* Anillo dentado giratorio premium (estilo engranaje rotando alrededor) */}
          {isPremium && (
            <>
              <svg
                className="absolute inset-[-14px] w-[124px] h-[124px] animate-spin pointer-events-none"
                style={{ animationDuration: "14s", filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.7))" }}
                viewBox="0 0 100 100"
                aria-hidden
              >
                {/* Engranaje: 12 dientes alrededor */}
                <g fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5">
                  <circle cx="50" cy="50" r="44" strokeDasharray="2 4" opacity="0.6" />
                </g>
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = (i * 360) / 12;
                  return (
                    <rect
                      key={i}
                      x="48.5"
                      y="2"
                      width="3"
                      height="7"
                      rx="0.8"
                      fill="hsl(var(--primary))"
                      transform={`rotate(${angle} 50 50)`}
                    />
                  );
                })}
              </svg>
              {/* Anillo interno contra-rotando (sutil) */}
              <svg
                className="absolute inset-[-6px] w-[108px] h-[108px] animate-spin pointer-events-none opacity-70"
                style={{ animationDuration: "9s", animationDirection: "reverse" }}
                viewBox="0 0 100 100"
                aria-hidden
              >
                <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" strokeDasharray="1 6" />
              </svg>
            </>
          )}

          <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-primary/60 relative" style={{ boxShadow: "0 0 24px hsl(var(--primary) / 0.5)" }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-2xl font-black text-primary-foreground">{profile?.username?.[0]?.toUpperCase() || "U"}</span>
              </div>
            )}
          </div>
          <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/80 transition z-10">
            <Camera className="w-3.5 h-3.5 text-primary-foreground" />
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </label>
        </div>
        <h1 className="text-lg font-black text-foreground mt-4">{profile?.display_name || profile?.username}</h1>
        <p className="text-xs text-muted-foreground">{user.email}</p>
        {isPremium && (
          <span className="mt-1 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-primary to-accent text-xs font-bold text-primary-foreground">
            <Crown className="w-3 h-3" /> PREMIUM
          </span>
        )}

        {/* Stats con marco steampunk */}
        <div className="mt-5 grid grid-cols-3 gap-2 w-full max-w-xs">
          {[
            { value: stats.lists, label: "En Listas" },
            { value: stats.episodes, label: "Episodios" },
            { value: stats.hours, label: "Horas" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border-2 border-primary/20 bg-secondary/40 py-2 px-1">
              <p className="text-xl font-black text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA grande hacia Mis Listas (steampunk) */}
      <Link
        to="/mis-listas"
        className="group relative block mb-4 rounded-2xl overflow-hidden border-2 border-primary/40 bg-gradient-to-r from-primary/15 via-secondary/60 to-primary/15 p-4 hover:border-primary transition-all"
        style={{ boxShadow: "0 0 20px hsl(var(--primary) / 0.25), inset 0 0 20px hsl(var(--primary) / 0.05)" }}
      >
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Library className="w-6 h-6 text-primary" />
            <Cog className="absolute -top-1 -right-1 w-4 h-4 text-primary animate-spin" style={{ animationDuration: "6s" }} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-black text-foreground tracking-tight">Mis Listas</p>
            <p className="text-[11px] text-muted-foreground">Favoritos · Viendo · Terminados · Plan · Indecisos</p>
          </div>
          <ChevronRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition" />
        </div>
      </Link>

      {/* Gestión de perfiles, dispositivos y PIN */}
      <ProfileManagementSection />

      {/* Acciones rediseñadas estilo steampunk */}
      <div className="space-y-2.5">
        <Link
          to="/settings"
          className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/60 border border-border hover:border-primary/50 hover:bg-secondary transition-all"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition">
            <Settings className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm text-foreground font-medium flex-1">Configuración</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition" />
        </Link>

        {!isPremium && (
          <button
            onClick={() => setShowPremiumModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/40 hover:from-primary/30 transition-all"
            style={{ boxShadow: "0 0 16px hsl(var(--primary) / 0.2)" }}
          >
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
              <Crown className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm text-foreground font-bold flex-1 text-left">Obtener Premium</span>
            <ChevronRight className="w-4 h-4 text-primary" />
          </button>
        )}

        {isPremium && (
          <button
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/40 hover:from-primary/25 transition-all disabled:opacity-60"
            style={{ boxShadow: "0 0 14px hsl(var(--primary) / 0.2)" }}
          >
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
              {exportingPdf ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <FileDown className="w-4 h-4 text-primary" />}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm text-foreground font-bold">Exportar Historial PDF</p>
              <p className="text-[10px] text-muted-foreground">Listas + estadísticas con tu color</p>
            </div>
            <Crown className="w-3.5 h-3.5 text-primary" />
          </button>
        )}

        {isAdmin && (
          <Link
            to="/admin"
            className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border-2 border-primary/40 hover:bg-primary/15 hover:border-primary transition-all"
            style={{ boxShadow: "0 0 14px hsl(var(--primary) / 0.25)" }}
          >
            <div className="w-9 h-9 rounded-lg bg-primary/25 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm text-primary font-bold flex-1">{isOwner ? "Panel Owner" : "Panel Admin"}</span>
            <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition" />
          </Link>
        )}

        {/* Contáctanos rediseñado */}
        {contacts.length > 0 && (
          <div className="pt-5">
            <div className="flex items-center gap-2 mb-3 px-1">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.15em]">Contáctanos</h3>
              <div className="flex-1 h-px bg-gradient-to-r from-primary/40 via-primary/10 to-transparent" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {contacts.map((c) => (
                <a
                  key={c.id}
                  href={c.url}
                  target="_blank"
                  rel="noopener"
                  className="group flex items-center gap-2.5 px-3 py-3 rounded-xl bg-secondary/60 border border-border hover:border-primary/50 hover:bg-secondary transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition">
                    {c.icon_url ? (
                      <img src={c.icon_url} alt="" className="w-5 h-5 rounded" />
                    ) : (
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color || "hsl(var(--primary))" }} />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-foreground truncate flex-1">{c.name}</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition" />
                </a>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={async () => {
            const url = `${window.location.origin}/download`;
            if (navigator.share) {
              try { await navigator.share({ title: "zetAnime APK", text: "Descarga zetAnime y mira anime sin límites", url }); return; } catch {}
            }
            await navigator.clipboard.writeText(url);
            toast.success("Enlace copiado al portapapeles");
          }}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary/10 to-transparent rounded-xl border border-primary/30 hover:from-primary/20 transition mt-4"
        >
          <Smartphone className="w-4 h-4 text-primary" />
          <span className="text-sm text-foreground font-bold flex-1 text-left">Compartir aplicación</span>
          <Share2 className="w-4 h-4 text-primary" />
        </button>

        <button onClick={() => { signOut(); navigate("/"); }} className="w-full flex items-center gap-3 px-4 py-3 bg-secondary rounded-xl hover:bg-destructive/10 transition mt-2">
          <LogOut className="w-4 h-4 text-destructive" /><span className="text-sm text-destructive">Cerrar Sesión</span>
        </button>
      </div>

      {showPremiumModal && <PremiumModal onClose={() => setShowPremiumModal(false)} />}
    </div>
  );
}

function PremiumModal({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<"info" | "form">("info");
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [membershipType, setMembershipType] = useState<"annual" | "lifetime">("annual");
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("admin_payment_info").select("*").limit(1).single().then(({ data }) => {
      if (data) setPaymentInfo(data);
    });
  }, []);

  const handleProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const submit = async () => {
    if (!user) return;
    setLoading(true);
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
      membership_type: membershipType,
      proof_url: proofUrl,
      notes,
    });
    setLoading(false);
    toast.success("Solicitud enviada. Te notificaremos cuando sea aprobada.");
    onClose();
  };


  const benefits = [
    { icon: Sparkles, title: "Sin anuncios", desc: "Experiencia 100% limpia, sin banners ni interrupciones" },
    { icon: FileDown, title: "Exportar historial PDF", desc: "Tus listas y estadísticas en un PDF elegante con tu color" },
    { icon: Palette, title: "Paleta de colores exclusiva", desc: "8 colores premium adicionales para personalizar la UI" },
    { icon: BadgeCheck, title: "Badge premium en tu perfil", desc: "Insignia dorada visible para destacar" },
    { icon: KeyRound, title: "PIN de cuenta", desc: "Protege tu cuenta con un PIN de 4 dígitos al iniciar sesión" },
    { icon: Users, title: "Hasta 5 dispositivos conectados", desc: "Free: 2 · Premium: 5 dispositivos simultáneos" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-foreground flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              {step === "info" ? "ZetAnime Premium" : "Solicitar Membresía"}
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>

          {step === "info" ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">Beneficios reales, sin promesas vacías:</p>
              <div className="space-y-2.5 mb-5">
                {benefits.map((b) => {
                  const Icon = b.icon;
                  return (
                    <div key={b.title} className="flex items-start gap-3 p-2.5 rounded-xl bg-secondary/50 border border-border">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">{b.title}</p>
                        <p className="text-[10px] text-muted-foreground leading-snug">{b.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setStep("form")} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold text-sm hover:opacity-90 transition">
                Solicitar Premium
              </button>
            </>
          ) : (
            <div className="space-y-4">
              {paymentInfo && (
                <div className="bg-secondary rounded-xl p-3 border border-border">
                  <p className="text-xs font-bold text-foreground mb-1">Datos de pago:</p>
                  <p className="text-[10px] text-muted-foreground">{paymentInfo.bank_name} · {paymentInfo.account_holder}</p>
                  <p className="text-[10px] text-muted-foreground">{paymentInfo.account_number}</p>
                  <p className="text-[10px] text-primary mt-1">Anual: {paymentInfo.price_annual} · Para Siempre: {paymentInfo.price_lifetime}</p>
                  {paymentInfo.instructions && <p className="text-[10px] text-muted-foreground mt-1">{paymentInfo.instructions}</p>}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setMembershipType("annual")} className={`flex-1 py-3 rounded-xl text-xs font-bold transition ${membershipType === "annual" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  📅 1 Año
                </button>
                <button onClick={() => setMembershipType("lifetime")} className={`flex-1 py-3 rounded-xl text-xs font-bold transition ${membershipType === "lifetime" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  ∞ Para Siempre
                </button>
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionales..." className="w-full h-20 bg-secondary border border-border rounded-xl p-3 text-sm text-foreground resize-none" />
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Comprobante de pago</label>
                <input type="file" accept="image/*" onChange={handleProof} className="text-xs text-muted-foreground" />
                {proofPreview && <img src={proofPreview} alt="preview" className="w-full h-32 object-contain mt-2 rounded-xl border border-border" />}
              </div>
              <button onClick={submit} disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />} Enviar Solicitud
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
