import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, BarChart3, Crown, Image, Store, CreditCard,
  Bell, MessageSquare, Users, Shield, X, Loader2, Search,
  Trash2, Pencil, Plus, ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";

const TABS = [
  { key: "stats", label: "Stats", icon: BarChart3 },
  { key: "premium", label: "Premium", icon: Crown },
  { key: "payment", label: "Pago", icon: CreditCard },
  { key: "notifs", label: "Notifs", icon: Bell },
  { key: "contacts", label: "Contactos", icon: MessageSquare },
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
        {tab === "premium" && <PremiumTab />}
        {tab === "payment" && <PaymentTab />}
        {tab === "notifs" && <NotifsTab />}
        {tab === "contacts" && <ContactsTab />}
      </div>
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState({ users: 0, premium: 0, episodes: 0, notifs: 0 });

  useEffect(() => {
    const load = async () => {
      const [{ count: users }, { count: premium }, { count: episodes }, { count: notifs }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "premium"),
        supabase.from("watch_history").select("*", { count: "exact", head: true }).eq("completed", true),
        supabase.from("notifications").select("*", { count: "exact", head: true }).eq("active", true),
      ]);
      setStats({ users: users || 0, premium: premium || 0, episodes: episodes || 0, notifs: notifs || 0 });
    };
    load();
  }, []);

  const cards = [
    { label: "Usuarios activos", value: stats.users, icon: Users, color: "text-primary" },
    { label: "Usuarios Premium", value: stats.premium, icon: Crown, color: "text-yellow-400" },
    { label: "Episodios vistos", value: stats.episodes, icon: BarChart3, color: "text-blue-400" },
    { label: "Notifs activas", value: stats.notifs, icon: Bell, color: "text-yellow-400" },
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

function PremiumTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    supabase.from("premium_requests").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setRequests(data);
    });
  }, []);

  const approve = async (req: any) => {
    // Add premium role
    await supabase.from("user_roles").insert({ user_id: req.user_id, role: "premium" as any });
    // Update membership
    const expires = req.membership_type === "annual" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null;
    await supabase.from("premium_memberships").insert({
      user_id: req.user_id, membership_type: req.membership_type, status: "active" as any,
      activated_at: new Date().toISOString(), expires_at: expires,
    });
    // Update request status  
    await supabase.from("premium_requests").update({ status: "active" as any }).eq("id", req.id);
    setRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: "active" } : r));
    toast.success("Premium activado");
  };

  const reject = async (req: any) => {
    await supabase.from("premium_requests").update({ status: "rejected" as any }).eq("id", req.id);
    setRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: "rejected" } : r));
    toast.info("Solicitud rechazada");
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
              <p className="text-[10px] text-muted-foreground">{req.membership_type === "annual" ? "1 Año" : "Vitalicio"} · {req.status}</p>
            </div>
            {req.status === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => approve(req)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold">✓</button>
                <button onClick={() => reject(req)} className="px-3 py-1.5 rounded-lg bg-destructive text-white text-xs font-bold">✗</button>
              </div>
            )}
          </div>
          {req.proof_url && (
            <a href={req.proof_url} target="_blank" rel="noopener" className="text-xs text-primary hover:underline mt-2 block">Ver comprobante →</a>
          )}
        </div>
      ))}
      {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No hay solicitudes</p>}
    </div>
  );
}

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
    if (existing) {
      await supabase.from("admin_payment_info").update(info).eq("id", existing.id);
    }
    setLoading(false);
    toast.success("Info de pago guardada");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><CreditCard className="w-4 h-4 text-green-400" /> Información Bancaria para Usuarios</h3>
      <p className="text-[10px] text-muted-foreground">Esta información se mostrará cuando soliciten Premium.</p>
      {[
        { key: "bank_name", label: "Banco / Plataforma" },
        { key: "account_holder", label: "Titular de la cuenta" },
        { key: "account_number", label: "Cuenta / CLABE / CBU" },
        { key: "price_annual", label: "Precio 1 año" },
        { key: "price_lifetime", label: "Precio Vitalicio" },
      ].map((f) => (
        <div key={f.key}>
          <label className="text-[10px] text-primary mb-1 block">{f.label}</label>
          <Input value={(info as any)[f.key]} onChange={(e) => setInfo({ ...info, [f.key]: e.target.value })} className="h-10 bg-secondary border-green-800/30 rounded-xl" />
        </div>
      ))}
      <div>
        <label className="text-[10px] text-primary mb-1 block">Instrucciones adicionales</label>
        <textarea value={info.instructions} onChange={(e) => setInfo({ ...info, instructions: e.target.value })} className="w-full h-24 bg-secondary border border-green-800/30 rounded-xl p-3 text-sm text-foreground resize-none" />
      </div>
      <button onClick={save} disabled={loading} className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} 💾 Guardar Info de Pago
      </button>
    </div>
  );
}

function NotifsTab() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!title || !message) return toast.error("Completa título y mensaje");
    setLoading(true);
    await supabase.from("notifications").insert({ title, message, type, created_by: user?.id });
    setLoading(false);
    setTitle("");
    setMessage("");
    toast.success("Notificación enviada a todos");
  };

  const types = ["info", "warning", "success", "danger"];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Bell className="w-4 h-4 text-yellow-400" /> Nueva Notificación</h3>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la notificación" className="h-10 bg-secondary border-primary/30 rounded-xl" />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mensaje completo..." className="w-full h-24 bg-secondary border border-primary/30 rounded-xl p-3 text-sm text-foreground resize-none" />
      <div className="flex gap-2">
        {types.map((t) => (
          <button key={t} onClick={() => setType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${type === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{t}</button>
        ))}
      </div>
      <button onClick={send} disabled={loading} className="w-full py-3 rounded-xl bg-primary/80 text-primary-foreground font-bold text-sm hover:bg-primary transition flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} 📢 Enviar a Todos
      </button>
    </div>
  );
}

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
    toast.info("Contacto eliminado");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Agregar Contacto</h3>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej: WhatsApp, Discord...)" className="h-10 bg-secondary border-primary/30 rounded-xl" />
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL del enlace" className="h-10 bg-secondary border-primary/30 rounded-xl" />
      <Input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="URL del logo/icono (opcional)" className="h-10 bg-secondary border-primary/30 rounded-xl" />
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
