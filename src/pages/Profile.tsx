import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Eye, CheckCircle, Clock, HelpCircle, Settings, LogOut, Crown, Shield, MessageSquare, FileText, ExternalLink, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AnimeCard from "@/components/anime/AnimeCard";
import type { AniListMedia } from "@/lib/anilist";

const LIST_TABS = [
  { value: "favorite" as const, label: "Favoritos", Icon: Heart },
  { value: "watching" as const, label: "Viendo", Icon: Eye },
  { value: "completed" as const, label: "Terminados", Icon: CheckCircle },
  { value: "plan_to_watch" as const, label: "Ver Después", Icon: Clock },
  { value: "undecided" as const, label: "Indecisos", Icon: HelpCircle },
];

export default function Profile() {
  const { user, profile, isPremium, isOwner, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("favorite");
  const [listAnimes, setListAnimes] = useState<any[]>([]);
  const [stats, setStats] = useState({ lists: 0, episodes: 0, hours: 0 });
  const [contacts, setContacts] = useState<any[]>([]);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadList(activeTab);
      loadStats();
    }
    loadContacts();
  }, [user, activeTab]);

  const loadList = async (listType: string) => {
    if (!user) return;
    const { data } = await supabase.from("anime_lists").select("*").eq("user_id", user.id).eq("list_type", listType as any);
    setListAnimes(data || []);
  };

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
    const path = `${user.id}/avatar.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toast.error("Error al subir imagen");
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", user.id);
    await refreshProfile();
    toast.success("Foto actualizada");
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-12 px-4 pb-24">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-24 h-24 rounded-full overflow-hidden mb-3 ring-1 ring-border">
            <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-2xl font-black text-white">Z</span>
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
      {/* Avatar & info */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-primary/50">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-2xl font-black text-white">{profile?.username?.[0]?.toUpperCase() || "U"}</span>
              </div>
            )}
          </div>
          <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/80 transition">
            <Camera className="w-3.5 h-3.5 text-primary-foreground" />
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </label>
        </div>
        <h1 className="text-lg font-black text-foreground mt-3">{profile?.display_name || profile?.username}</h1>
        <p className="text-xs text-muted-foreground">{user.email}</p>
        {isPremium && (
          <span className="mt-1 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-primary to-accent text-xs font-bold text-white">
            <Crown className="w-3 h-3" /> PREMIUM
          </span>
        )}
        <div className="flex gap-6 mt-5">
          <div className="text-center"><p className="text-xl font-black text-foreground">{stats.lists}</p><p className="text-[10px] text-muted-foreground font-medium">En Listas</p></div>
          <div className="w-px bg-border" />
          <div className="text-center"><p className="text-xl font-black text-foreground">{stats.episodes}</p><p className="text-[10px] text-muted-foreground font-medium">Episodios</p></div>
          <div className="w-px bg-border" />
          <div className="text-center"><p className="text-xl font-black text-foreground">{stats.hours}</p><p className="text-[10px] text-muted-foreground font-medium">Horas</p></div>
        </div>
      </div>

      {/* List tabs */}
      <div className="flex gap-0 rounded-2xl overflow-hidden border border-primary/30 mb-4">
        {LIST_TABS.map(({ value, label, Icon }) => (
          <button key={value} onClick={() => setActiveTab(value)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-all ${activeTab === value ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
            <Icon className="w-3 h-3" /><span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* List content */}
      <div className="mb-6">
        {listAnimes.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground text-sm">No hay animes en esta lista</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {listAnimes.map((item) => (
              <Link key={item.id} to={`/anime/${item.anime_id}`} className="block">
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-secondary">
                  {item.anime_cover && <img src={item.anime_cover} alt={item.anime_title} className="w-full h-full object-cover" />}
                </div>
                <p className="text-[10px] font-medium text-muted-foreground line-clamp-2 mt-1">{item.anime_title}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Link to="/settings" className="flex items-center gap-3 px-4 py-3 bg-secondary rounded-xl hover:bg-muted transition">
          <Settings className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-foreground">Configuración</span>
        </Link>
        {!isPremium && (
          <button onClick={() => setShowPremiumModal(true)} className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl border border-primary/30 hover:from-primary/30 transition">
            <Crown className="w-4 h-4 text-primary" /><span className="text-sm text-foreground font-bold">Obtener Premium</span>
          </button>
        )}
        {isOwner && (
          <Link to="/admin" className="flex items-center gap-3 px-4 py-3 bg-secondary rounded-xl border border-primary/20 hover:bg-muted transition">
            <Shield className="w-4 h-4 text-primary" /><span className="text-sm text-primary font-bold">Panel Admin</span>
          </Link>
        )}

        {/* Contacts */}
        {contacts.length > 0 && (
          <div className="pt-4">
            <h3 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Contáctanos</h3>
            <div className="grid grid-cols-2 gap-2">
              {contacts.map((c) => (
                <a key={c.id} href={c.url} target="_blank" rel="noopener" className="flex items-center gap-2 px-3 py-2.5 bg-secondary rounded-xl border border-border hover:border-primary/30 transition">
                  {c.icon_url ? (
                    <img src={c.icon_url} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: c.color || "#FF4500" }} />
                  )}
                  <span className="text-xs font-medium text-foreground truncate">{c.name}</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto" />
                </a>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => { signOut(); navigate("/"); }} className="w-full flex items-center gap-3 px-4 py-3 bg-secondary rounded-xl hover:bg-destructive/10 transition mt-4">
          <LogOut className="w-4 h-4 text-destructive" /><span className="text-sm text-destructive">Cerrar Sesión</span>
        </button>
      </div>

      {/* Premium modal */}
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
      const path = `${user.id}/${Date.now()}-${proofFile.name}`;
      await supabase.storage.from("premium-proofs").upload(path, proofFile);
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
    "Sin anuncios interrumpidos",
    "Calidad alta (1080p)",
    "Descarga de episodios offline",
    "Acceso prioritario a nuevos episodios",
    "Exportar historial en PDF",
    "Badge premium exclusivo",
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
              <p className="text-sm text-muted-foreground mb-4">Desbloquea la experiencia completa:</p>
              <div className="space-y-2 mb-6">
                {benefits.map((b) => (
                  <div key={b} className="flex items-center gap-2 text-sm text-foreground">
                    <span className="text-primary">✓</span> {b}
                  </div>
                ))}
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
                  <p className="text-[10px] text-primary mt-1">Anual: {paymentInfo.price_annual} · Vitalicio: {paymentInfo.price_lifetime}</p>
                  {paymentInfo.instructions && <p className="text-[10px] text-muted-foreground mt-1">{paymentInfo.instructions}</p>}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setMembershipType("annual")} className={`flex-1 py-3 rounded-xl text-xs font-bold transition ${membershipType === "annual" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  📅 1 Año
                </button>
                <button onClick={() => setMembershipType("lifetime")} className={`flex-1 py-3 rounded-xl text-xs font-bold transition ${membershipType === "lifetime" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  ∞ Vitalicio
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
