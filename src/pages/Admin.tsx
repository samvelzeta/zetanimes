import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, BarChart3, Crown, Image, Store, CreditCard,
  Bell, MessageSquare, Users, Shield, X, Loader2, Search,
  Trash2, Pencil, Plus, ExternalLink, Key, Link2, Film, AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import DownloadTracker from "@/components/admin/DownloadTracker";
import VideoManager from "@/components/admin/VideoManager";
import BrokenReports from "@/components/admin/BrokenReports";

const TABS = [
  { key: "stats", label: "Stats", icon: BarChart3 },
  { key: "downloads", label: "Descargas", icon: Store },
  { key: "videos", label: "Videos", icon: Film },
  { key: "reports", label: "Reportes", icon: AlertTriangle },
  { key: "premium", label: "Premium", icon: Crown },
  { key: "payment", label: "Pago", icon: CreditCard },
  { key: "notifs", label: "Notifs", icon: Bell },
  { key: "contacts", label: "Contactos", icon: MessageSquare },
  { key: "apikeys", label: "API Keys", icon: Key },
];

export default function AdminPanel() {
  const { isOwner, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("stats");

  useEffect(() => {
    if (!authLoading && !isOwner) {
      toast.error("Acceso restringido");
      navigate("/");
    }
  }, [authLoading, isOwner]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isOwner) return null;

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/profile" className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center"><ArrowLeft className="w-5 h-5 text-foreground" /></Link>
        <div>
          <h1 className="text-base font-black text-foreground flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Panel Admin</h1>
          <p className="text-[10px] text-muted-foreground">zetAnime · Área restringida</p>
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-green-500" />
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pt-4 hide-scrollbar">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-6">
        {tab === "stats" && <StatsTab />}
        {tab === "downloads" && <DownloadTracker />}
        {tab === "videos" && <VideoManager />}
        {tab === "reports" && <BrokenReports />}
        {tab === "premium" && <PremiumTab />}
        {tab === "payment" && <PaymentTab />}
        {tab === "notifs" && <NotifsTab />}
        {tab === "contacts" && <ContactsTab />}
        {tab === "apikeys" && <ApiKeysTab />}
      </div>
    </div>
  );
}

// ========== STATS ==========
function StatsTab() {
  const [stats, setStats] = useState({ users: 0, premium: 0, episodes: 0, notifs: 0, latino: 0 });

  useEffect(() => {
    const load = async () => {
      const [{ count: users }, { count: premium }, { count: episodes }, { count: notifs }, { count: latino }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "premium"),
        supabase.from("watch_history").select("*", { count: "exact", head: true }).eq("completed", true),
        supabase.from("notifications").select("*", { count: "exact", head: true }).eq("active", true),
        supabase.from("latino_episodes" as any).select("*", { count: "exact", head: true }).eq("status", "uploaded"),
      ]);
      setStats({ users: users || 0, premium: premium || 0, episodes: episodes || 0, notifs: notifs || 0, latino: latino || 0 });
    };
    load();
  }, []);

  const cards = [
    { label: "Usuarios activos", value: stats.users, icon: Users, color: "text-primary" },
    { label: "Usuarios Premium", value: stats.premium, icon: Crown, color: "text-yellow-400" },
    { label: "Episodios vistos", value: stats.episodes, icon: BarChart3, color: "text-blue-400" },
    { label: "Notifs activas", value: stats.notifs, icon: Bell, color: "text-yellow-400" },
    { label: "Eps Latino HLS", value: stats.latino, icon: BarChart3, color: "text-green-400" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-secondary rounded-xl p-4 border border-border">
          <c.icon className={`w-5 h-5 ${c.color} mb-2`} />
          <p className="text-2xl font-black text-foreground">{c.value}</p>
          <p className="text-[10px] text-muted-foreground">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

// ========== OVERRIDE URL ==========
function OverrideURLTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<{ slug: string; title: string; cover: string } | null>(null);
  const [overrideUrl, setOverrideUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (val.length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { searchAnime } = await import("@/lib/anilist");
        const res = await searchAnime(val, 1, 8);
        setSearchResults(res.media || []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
  };

  const selectAnime = (anime: any) => {
    const slug = anime.title?.romaji?.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "";
    setSelectedAnime({
      slug,
      title: anime.title?.romaji || anime.title?.english || "",
      cover: anime.coverImage?.medium || anime.coverImage?.large || "",
    });
    setSearchQuery("");
    setSearchResults([]);
  };

  const sendOverride = async () => {
    if (!selectedAnime?.slug || !overrideUrl.trim()) return toast.error("Completa todos los campos");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("https://zetapi-api.samvelzeta.workers.dev/api/admin/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selectedAnime.slug,
          url: overrideUrl.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult("✅ Override registrado correctamente");
        toast.success("Override enviado");
        setOverrideUrl("");
      } else {
        setResult(`❌ Error: ${data.message || data.error || "Error desconocido"}`);
        toast.error("Error al enviar override");
      }
    } catch (e: any) {
      setResult(`❌ Error: ${e.message}`);
      toast.error(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Link2 className="w-4 h-4 text-primary" /> Override URL de Anime (Sub)
      </h3>
      <p className="text-[10px] text-muted-foreground">
        Para animes que no se encuentran automáticamente. Envía la URL directa para que la API resuelva los servidores.
      </p>

      <div className="relative">
        <label className="text-[10px] text-primary mb-1 block">Buscar anime</label>
        {selectedAnime ? (
          <div className="flex items-center gap-3 bg-secondary rounded-xl p-3 border border-primary/30">
            {selectedAnime.cover && <img src={selectedAnime.cover} alt="" className="w-10 h-14 rounded object-cover" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{selectedAnime.title}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{selectedAnime.slug}</p>
            </div>
            <button onClick={() => setSelectedAnime(null)} className="text-muted-foreground hover:text-destructive">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar anime por nombre..." className="pl-10 h-10 bg-secondary border-primary/30 rounded-xl" />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
            </div>
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                {searchResults.map((anime: any) => (
                  <button key={anime.id} onClick={() => selectAnime(anime)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-secondary transition text-left border-b border-border last:border-0">
                    <img src={anime.coverImage?.medium || ""} alt="" className="w-8 h-12 rounded object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{anime.title?.romaji || anime.title?.english}</p>
                      <p className="text-[10px] text-muted-foreground">{anime.episodes ? `${anime.episodes} eps` : "?"} · {anime.status}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <label className="text-[10px] text-primary mb-1 block">URL directa del anime</label>
        <Input value={overrideUrl} onChange={(e) => setOverrideUrl(e.target.value)} placeholder="https://jkanime.net/anime-slug/"
          className="h-10 bg-secondary border-primary/30 rounded-xl font-mono text-xs" />
      </div>

      <button onClick={sendOverride} disabled={loading || !selectedAnime || !overrideUrl}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition flex items-center justify-center gap-2 disabled:opacity-50">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} 🔗 Enviar Override
      </button>

      {result && (
        <div className={`rounded-xl p-3 text-xs font-medium ${result.startsWith("✅") ? "bg-green-600/10 border border-green-600/30 text-green-400" : "bg-destructive/10 border border-destructive/30 text-destructive"}`}>
          {result}
        </div>
      )}
    </div>
  );
}

// ========== PREMIUM ==========
function PremiumTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    supabase.from("premium_requests").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setRequests(data);
    });
  }, []);

  const approve = async (req: any, type: "annual" | "lifetime") => {
    setActionLoading(true);
    try {
      await supabase.from("user_roles").insert({ user_id: req.user_id, role: "premium" as any });
      const expires = type === "annual" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null;
      await supabase.from("premium_memberships").insert({
        user_id: req.user_id, membership_type: type, status: "active" as any,
        activated_at: new Date().toISOString(), expires_at: expires,
      });
      await supabase.from("premium_requests").update({ status: "active" as any }).eq("id", req.id);
      await supabase.from("notifications").insert({
        title: "🎉 ¡Premium Activado!",
        message: `Tu membresía ${type === "annual" ? "Anual" : "Para Siempre"} ha sido aprobada. ¡Disfruta de todos los beneficios!`,
        type: "success",
      });
      setRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: "active" } : r));
      setSelectedReq(null);
      toast.success("Premium activado y usuario notificado");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
    setActionLoading(false);
  };

  const reject = async (req: any) => {
    if (!rejectReason.trim()) return toast.error("Escribe un motivo de rechazo");
    setActionLoading(true);
    try {
      await supabase.from("premium_requests").update({ status: "rejected" as any, notes: rejectReason }).eq("id", req.id);
      setRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: "rejected" } : r));
      setSelectedReq(null);
      setRejectReason("");
      toast.info("Solicitud rechazada");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
    setActionLoading(false);
  };

  const filtered = requests.filter((r) => !searchQ || r.email?.includes(searchQ) || r.username?.includes(searchQ));

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Buscar usuario..." className="pl-10 h-10 bg-secondary border-primary/30 rounded-xl" />
      </div>
      {filtered.map((req) => (
        <div key={req.id} className="bg-secondary rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">{req.email || req.username}</p>
              <p className="text-[10px] text-muted-foreground">{req.membership_type === "annual" ? "1 Año" : "Para Siempre"} · {req.status}</p>
            </div>
            {req.status === "pending" && (
              <button onClick={() => setSelectedReq(req)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Revisar</button>
            )}
          </div>
          {req.notes && <p className="text-[10px] text-muted-foreground mt-1">Nota: {req.notes}</p>}
        </div>
      ))}
      {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No hay solicitudes</p>}

      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setSelectedReq(null)}>
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-foreground flex items-center gap-2"><Crown className="w-4 h-4 text-primary" /> Revisar Solicitud</h2>
                <button onClick={() => setSelectedReq(null)} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>
              <div className="bg-secondary rounded-xl p-3 border border-border space-y-1">
                <p className="text-sm font-bold text-foreground">{selectedReq.email || selectedReq.username}</p>
                <p className="text-xs text-muted-foreground">Plan solicitado: <span className="text-primary font-bold">{selectedReq.membership_type === "annual" ? "1 Año" : "Para Siempre"}</span></p>
                {selectedReq.notes && <p className="text-xs text-muted-foreground">Mensaje: {selectedReq.notes}</p>}
                <p className="text-[10px] text-muted-foreground">{new Date(selectedReq.created_at).toLocaleString()}</p>
              </div>
              {selectedReq.proof_url ? (
                <div>
                  <p className="text-xs font-bold text-foreground mb-2">Comprobante de pago:</p>
                  <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/premium-proofs/${selectedReq.proof_url}`} alt="Comprobante" className="w-full rounded-xl border border-border max-h-64 object-contain bg-black/20" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sin comprobante adjunto</p>
              )}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">Aprobar como:</p>
                <div className="flex gap-2">
                  <button onClick={() => approve(selectedReq, "annual")} disabled={actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-1">
                    {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />} ✓ Anual
                  </button>
                  <button onClick={() => approve(selectedReq, "lifetime")} disabled={actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-1">
                    {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />} ∞ Para Siempre
                  </button>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-bold text-foreground">Rechazar:</p>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Motivo del rechazo..." className="w-full h-16 bg-secondary border border-border rounded-xl p-3 text-xs text-foreground resize-none" />
                <button onClick={() => reject(selectedReq)} disabled={actionLoading || !rejectReason.trim()}
                  className="w-full py-2.5 rounded-xl bg-destructive text-white text-xs font-bold hover:bg-destructive/90 transition disabled:opacity-50 flex items-center justify-center gap-1">
                  {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />} ✗ Rechazar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== PAYMENT ==========
function PaymentTab() {
  const [info, setInfo] = useState({ bank_name: "", account_holder: "", account_number: "", price_annual: "", price_lifetime: "", instructions: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("admin_payment_info").select("*").limit(1).single().then(({ data }) => {
      if (data) setInfo({ bank_name: data.bank_name || "", account_holder: data.account_holder || "", account_number: data.account_number || "", price_annual: data.price_annual || "", price_lifetime: data.price_lifetime || "", instructions: data.instructions || "" });
    });
  }, []);

  const save = async () => {
    setLoading(true);
    const { data: existing } = await supabase.from("admin_payment_info").select("id").limit(1).single();
    if (existing) await supabase.from("admin_payment_info").update(info).eq("id", existing.id);
    setLoading(false);
    toast.success("Info de pago guardada");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><CreditCard className="w-4 h-4 text-green-400" /> Información Bancaria</h3>
      {[
        { key: "bank_name", label: "Banco / Plataforma" },
        { key: "account_holder", label: "Titular de la cuenta" },
        { key: "account_number", label: "Cuenta / CLABE / CBU" },
        { key: "price_annual", label: "Precio 1 año" },
        { key: "price_lifetime", label: "Precio Para Siempre" },
      ].map((f) => (
        <div key={f.key}>
          <label className="text-[10px] text-primary mb-1 block">{f.label}</label>
          <Input value={(info as any)[f.key]} onChange={(e) => setInfo({ ...info, [f.key]: e.target.value })} className="h-10 bg-secondary border-primary/30 rounded-xl" />
        </div>
      ))}
      <div>
        <label className="text-[10px] text-primary mb-1 block">Instrucciones</label>
        <textarea value={info.instructions} onChange={(e) => setInfo({ ...info, instructions: e.target.value })} className="w-full h-24 bg-secondary border border-primary/30 rounded-xl p-3 text-sm text-foreground resize-none" />
      </div>
      <button onClick={save} disabled={loading} className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} 💾 Guardar
      </button>
    </div>
  );
}

// ========== NOTIFS (with history + delete) ==========
function NotifsTab() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
    if (data) setNotifications(data);
  };

  const send = async () => {
    if (!title || !message) return toast.error("Completa título y mensaje");
    setLoading(true);
    await supabase.from("notifications").insert({ title, message, type, created_by: user?.id });
    setLoading(false);
    setTitle(""); setMessage("");
    toast.success("Notificación enviada a todos");
    loadNotifications();
  };

  const deleteNotif = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notificación eliminada");
  };

  const typeColors: Record<string, string> = {
    info: "bg-blue-600/20 text-blue-400",
    warning: "bg-yellow-600/20 text-yellow-400",
    success: "bg-green-600/20 text-green-400",
    danger: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Bell className="w-4 h-4 text-yellow-400" /> Nueva Notificación</h3>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="h-10 bg-secondary border-primary/30 rounded-xl" />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mensaje..." className="w-full h-24 bg-secondary border border-primary/30 rounded-xl p-3 text-sm text-foreground resize-none" />
      <div className="flex gap-2">
        {["info", "warning", "success", "danger"].map((t) => (
          <button key={t} onClick={() => setType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${type === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{t}</button>
        ))}
      </div>
      <button onClick={send} disabled={loading} className="w-full py-3 rounded-xl bg-primary/80 text-primary-foreground font-bold text-sm hover:bg-primary transition flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} 📢 Enviar
      </button>

      {/* Notification history */}
      <div className="mt-6">
        <h4 className="text-xs font-bold text-foreground mb-3">Historial de notificaciones</h4>
        {notifications.length === 0 ? (
          <p className="text-[10px] text-muted-foreground text-center py-4">No hay notificaciones</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 bg-secondary rounded-xl p-3 border border-border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${typeColors[n.type] || "bg-muted text-muted-foreground"}`}>{n.type}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                    {n.active && <span className="w-2 h-2 rounded-full bg-green-500" />}
                  </div>
                  <p className="text-xs font-bold text-foreground">{n.title}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{n.message}</p>
                </div>
                <button onClick={() => deleteNotif(n.id)} className="text-muted-foreground hover:text-destructive transition flex-shrink-0 mt-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== CONTACTS ==========
function ContactsTab() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [color, setColor] = useState("#FF4500");

  useEffect(() => {
    supabase.from("contact_links").select("*").order("sort_order").then(({ data }) => {
      if (data) setContacts(data);
    });
  }, []);

  const add = async () => {
    if (!name || !url) return toast.error("Nombre y URL requeridos");
    const { data } = await supabase.from("contact_links").insert({ name, url, icon_url: iconUrl || null, color, sort_order: contacts.length }).select().single();
    if (data) setContacts([...contacts, data]);
    setName(""); setUrl(""); setIconUrl("");
    toast.success("Contacto agregado");
  };

  const remove = async (id: string) => {
    await supabase.from("contact_links").delete().eq("id", id);
    setContacts(contacts.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Contactos</h3>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="h-10 bg-secondary border-primary/30 rounded-xl" />
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" className="h-10 bg-secondary border-primary/30 rounded-xl" />
      <Input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="URL icono (opcional)" className="h-10 bg-secondary border-primary/30 rounded-xl" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Color:</span>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
      </div>
      <button onClick={add} className="w-full py-3 rounded-xl bg-primary/80 text-primary-foreground font-bold text-sm hover:bg-primary transition flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> Agregar
      </button>
      <div className="divide-y divide-border mt-4">
        {contacts.map((c) => (
          <div key={c.id} className="flex items-center gap-3 py-3">
            {c.icon_url ? (
              <img src={c.icon_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: c.color || "#FF4500" }}>
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{c.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{c.url}</p>
            </div>
            <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== API KEYS ==========
function ApiKeysTab() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const updateKey = async () => {
    if (!apiKey.trim()) return toast.error("Ingresa la API key");
    setLoading(true);
    try {
      const res = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/update-api-key`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ key_name: "ZET_API_KEY", key_value: apiKey.trim() }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      setLastUpdated(new Date().toLocaleString());
      setApiKey("");
      toast.success("API Key actualizada");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Key className="w-4 h-4 text-primary" /> API Keys</h3>
      <p className="text-[10px] text-muted-foreground">Actualiza la API key de ZetAPI cuando expire.</p>
      <div>
        <label className="text-[10px] text-primary mb-1 block">ZET API Key</label>
        <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Nueva API key..." className="h-10 bg-secondary border-primary/30 rounded-xl font-mono" />
      </div>
      {lastUpdated && <p className="text-[10px] text-green-400">✓ Última actualización: {lastUpdated}</p>}
      <button onClick={updateKey} disabled={loading} className="w-full py-3 rounded-xl bg-primary/80 text-primary-foreground font-bold text-sm hover:bg-primary transition flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} 🔑 Actualizar
      </button>
      <div className="bg-secondary/50 border border-border rounded-xl p-3 mt-4">
        <p className="text-[10px] text-muted-foreground">⚠️ La key nunca se muestra una vez guardada.</p>
      </div>
    </div>
  );
}
