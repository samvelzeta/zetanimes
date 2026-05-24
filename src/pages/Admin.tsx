import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, BarChart3, Crown, Image, Store, CreditCard,
  Bell, MessageSquare, Users, Shield, X, Loader2, Search,
  Trash2, Pencil, Plus, ExternalLink, Key, Link2, Film, AlertTriangle, ListOrdered, Bug, Activity,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import DownloadTracker from "@/components/admin/DownloadTracker";
import VideoManager from "@/components/admin/VideoManager";
import ApiDebugPanel from "@/components/admin/ApiDebugPanel";
import BrokenReports from "@/components/admin/BrokenReports";
import SlugManager from "@/components/admin/SlugManager";
import HiddenAnimesManager from "@/components/admin/HiddenAnimesManager";
import ApkManager from "@/components/admin/ApkManager";
import EpisodeCountManager from "@/components/admin/EpisodeCountManager";
import RoleManager from "@/components/admin/RoleManager";
import ActivityLogTab from "@/components/admin/ActivityLogTab";
import PremiumConfigEditor from "@/components/admin/PremiumConfigEditor";
import RankingOverridesAdmin from "@/components/admin/RankingOverridesAdmin";
import { logAdminActivity } from "@/lib/admin-log";

// Tabs reservados solo para owner — los admins NO ven ni pueden interactuar con APK, notificaciones, pagos, premium, API keys, roles ni historial.
const OWNER_ONLY_TABS = new Set(["premium", "payment", "apikeys", "roles", "activity", "apk", "notifs"]);

const TABS = [
  { key: "stats", label: "Stats", icon: BarChart3 },
  { key: "activity", label: "Historial", icon: Activity },
  { key: "downloads", label: "Descargas", icon: Store },
  { key: "videos", label: "Videos", icon: Film },
  { key: "apidebug", label: "API JSON", icon: Bug },
  { key: "epcount", label: "Episodios", icon: ListOrdered },
  { key: "slugs", label: "Slugs", icon: Link2 },
  { key: "hidden", label: "Ocultar", icon: X },
  { key: "ranking", label: "Top Ranking", icon: ListOrdered },
  { key: "apk", label: "APK", icon: ExternalLink },
  { key: "reports", label: "Reportes", icon: AlertTriangle },
  { key: "premium", label: "Premium", icon: Crown },
  { key: "payment", label: "Pago", icon: CreditCard },
  { key: "notifs", label: "Notifs", icon: Bell },
  { key: "contacts", label: "Contactos", icon: MessageSquare },
  { key: "apikeys", label: "API Keys", icon: Key },
  { key: "roles", label: "Roles", icon: Users },
];

export default function AdminPanel() {
  const { isOwner, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("stats");

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error("Acceso restringido");
      navigate("/");
    }
  }, [authLoading, isAdmin]);

  // Si un admin (no owner) intenta abrir un tab restringido, redirigir a stats
  useEffect(() => {
    if (!isOwner && OWNER_ONLY_TABS.has(tab)) setTab("stats");
  }, [isOwner, tab]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return null;

  // Filtrar tabs visibles según rol
  const visibleTabs = TABS.filter((t) => isOwner || !OWNER_ONLY_TABS.has(t.key));

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/profile" className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center"><ArrowLeft className="w-5 h-5 text-foreground" /></Link>
        <div>
          <h1 className="text-base font-black text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Panel {isOwner ? "Owner" : "Admin"}
          </h1>
          <p className="text-[10px] text-muted-foreground">
            zetAnime · {isOwner ? "Acceso total" : "Acceso de soporte"}
          </p>
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-green-500" />
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pt-4 hide-scrollbar">
        {visibleTabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-6">
        {tab === "stats" && <StatsTab />}
        {isOwner && tab === "activity" && <ActivityLogTab />}
        {tab === "downloads" && <DownloadTracker />}
        {tab === "videos" && <VideoManager />}
        {tab === "apidebug" && <ApiDebugPanel />}
        {tab === "epcount" && <EpisodeCountManager />}
        {tab === "slugs" && <SlugManager />}
        {tab === "hidden" && <HiddenAnimesManager />}
        {tab === "ranking" && <RankingOverridesAdmin />}
        {tab === "apk" && isOwner && <ApkManager />}
        {tab === "reports" && <BrokenReports />}
        {isOwner && tab === "premium" && <PremiumTab />}
        {isOwner && tab === "payment" && <PaymentTab />}
        {tab === "notifs" && isOwner && <NotifsTab />}
        {tab === "contacts" && <ContactsTab />}
        {isOwner && tab === "apikeys" && <ApiKeysTab />}
        {isOwner && tab === "roles" && <RoleManager />}
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
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("subscription_status", "active"),
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

// OverrideURLTab removed - replaced by VideoManager component
// ========== PROOF IMAGE (signed URL) ==========
function ProofImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.storage
      .from("premium-proofs")
      .createSignedUrl(path, 60 * 30)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data) setErr(error?.message || "no se pudo cargar");
        else setUrl(data.signedUrl);
      });
    return () => { alive = false; };
  }, [path]);
  return (
    <div>
      <p className="text-xs font-bold text-foreground mb-2">Comprobante de pago:</p>
      {url ? (
        <a href={url} target="_blank" rel="noopener">
          <img src={url} alt="Comprobante" className="w-full rounded-xl border border-border max-h-64 object-contain bg-black/20" />
        </a>
      ) : err ? (
        <p className="text-xs text-destructive">No se pudo cargar el comprobante: {err}</p>
      ) : (
        <div className="w-full h-32 rounded-xl border border-border bg-secondary animate-pulse" />
      )}
      <p className="text-[10px] text-muted-foreground mt-1 break-all">{path}</p>
    </div>
  );
}

// ========== PREMIUM (gestión manual de suscripciones) ==========
function PremiumTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [planType, setPlanType] = useState<"basico" | "solo" | "duo">("solo");
  const [days, setDays] = useState<number>(365);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, subscription_status, plan_type, subscription_email, subscription_expires_at, subscription_updated_at")
      .order("subscription_updated_at", { ascending: false })
      .limit(200);
    setUsers((data as any[]) || []);
  };

  useEffect(() => { load(); }, []);

  const applyUpdate = async (status: "active" | "inactive" | "expired") => {
    if (!editing) return;
    setSaving(true);
    try {
      const expires =
        status === "active"
          ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
          : null;
      await supabase
        .from("profiles")
        .update({
          subscription_status: status,
          plan_type: status === "active" ? planType : null,
          subscription_expires_at: expires,
          subscription_updated_at: new Date().toISOString(),
        } as any)
        .eq("user_id", editing.user_id);
      await logAdminActivity({
        area: "payments",
        action: status === "active" ? "create" : "delete",
        summary: `${status === "active" ? "Activó" : "Desactivó"} Premium ${status === "active" ? planType : ""} de ${editing.username || editing.user_id}`,
        target_type: "user",
        target_id: editing.user_id,
      });
      toast.success(status === "active" ? "Premium activado" : "Premium desactivado");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
    setSaving(false);
  };

  const filtered = users.filter(
    (u) =>
      !searchQ ||
      u.username?.toLowerCase().includes(searchQ.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(searchQ.toLowerCase()) ||
      u.subscription_email?.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-secondary/60 p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Las suscripciones ahora se activan automáticamente vía <strong>Ko-fi + Make.com → edge function <code>kofi-webhook</code></strong>.
          Aquí solo necesitas intervenir si quieres ajustar manualmente un usuario (regalo, error, etc.).
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Buscar por usuario o email..."
          className="pl-10 h-10 bg-secondary border-primary/30 rounded-xl"
        />
      </div>

      {filtered.map((u) => (
        <div
          key={u.user_id}
          className="bg-secondary rounded-xl p-4 border border-border flex items-center justify-between"
        >
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">
              {u.display_name || u.username}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {u.subscription_email || "sin email Ko-fi"} ·{" "}
              <span
                className={
                  u.subscription_status === "active" ? "text-green-400" : "text-muted-foreground"
                }
              >
                {u.subscription_status}
              </span>
              {u.plan_type ? ` · ${u.plan_type}` : ""}
              {u.subscription_expires_at
                ? ` · vence ${new Date(u.subscription_expires_at).toLocaleDateString()}`
                : ""}
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(u);
              setPlanType((u.plan_type as any) || "solo");
              setDays(365);
            }}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
          >
            Editar
          </button>
        </div>
      ))}
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Sin usuarios</p>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-foreground flex items-center gap-2">
                <Crown className="w-4 h-4 text-primary" /> Editar suscripción
              </h2>
              <button onClick={() => setEditing(null)} className="text-muted-foreground">✕</button>
            </div>
            <p className="text-sm font-bold text-foreground">{editing.display_name || editing.username}</p>

            <div>
              <label className="text-[10px] text-primary mb-1 block">Plan</label>
              <select
                value={planType}
                onChange={(e) => setPlanType(e.target.value as any)}
                className="w-full h-10 bg-secondary border border-primary/30 rounded-xl px-3 text-sm text-foreground"
              >
                <option value="basico">Básico ($5/año)</option>
                <option value="solo">Solo ($8/año)</option>
                <option value="duo">Dúo ($10/año)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-primary mb-1 block">Duración (días)</label>
              <Input
                type="number"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value) || 365)}
                className="h-10 bg-secondary border-primary/30 rounded-xl"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => applyUpdate("active")}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />} Activar
              </button>
              <button
                onClick={() => applyUpdate("inactive")}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />} Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== PAYMENT (info estática Ko-fi) ==========
function PaymentTab() {
  return (
    <div className="space-y-6">
      <PremiumConfigEditor />
      <div className="rounded-xl border border-border bg-secondary/60 p-5 space-y-2">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-green-400" /> Método de pago
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Todos los pagos pasan por <a href="https://ko-fi.com/zetanimes" target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">ko-fi.com/zetanimes</a>.
          No hace falta configurar datos bancarios aquí — Ko-fi gestiona el cobro y Make.com activa el premium automáticamente.
        </p>
      </div>
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
    await logAdminActivity({ area: "notifications", action: "create", summary: `Envió notificación "${title}" (${type})` });
    setTitle(""); setMessage("");
    toast.success("Notificación enviada a todos");
    loadNotifications();
  };

  const deleteNotif = async (id: string) => {
    const n = notifications.find((x) => x.id === id);
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await logAdminActivity({ area: "notifications", action: "delete", summary: `Eliminó notificación "${n?.title || id}"` });
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
