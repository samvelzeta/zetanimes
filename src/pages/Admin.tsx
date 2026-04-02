import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, BarChart3, Crown, Image, Store, CreditCard,
  Bell, MessageSquare, Users, Shield, X, Loader2, Search,
  Trash2, Pencil, Plus, ExternalLink, Key, Upload, Settings,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import DownloadTracker from "@/components/admin/DownloadTracker";

const TABS = [
  { key: "stats", label: "Stats", icon: BarChart3 },
  { key: "downloads", label: "Descargas", icon: Store },
  { key: "upload", label: "Upload HLS", icon: Upload },
  { key: "premium", label: "Premium", icon: Crown },
  { key: "payment", label: "Pago", icon: CreditCard },
  { key: "notifs", label: "Notifs", icon: Bell },
  { key: "contacts", label: "Contactos", icon: MessageSquare },
  { key: "apikeys", label: "API Keys", icon: Key },
  { key: "settings", label: "Config R2", icon: Settings },
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
        {tab === "upload" && <UploadHLSTab />}
        {tab === "premium" && <PremiumTab />}
        {tab === "payment" && <PaymentTab />}
        {tab === "notifs" && <NotifsTab />}
        {tab === "contacts" && <ContactsTab />}
        {tab === "apikeys" && <ApiKeysTab />}
        {tab === "settings" && <R2SettingsTab />}
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
    { label: "Eps Latino HLS", value: stats.latino, icon: Upload, color: "text-green-400" },
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

// ========== UPLOAD HLS ==========
function UploadHLSTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<{ slug: string; title: string; cover: string } | null>(null);
  const [epNumber, setEpNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [newServerUrl, setNewServerUrl] = useState("");
  const [episodeStatuses, setEpisodeStatuses] = useState<any[]>([]);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadEpisodes();
  }, []);

  const loadEpisodes = async () => {
    const { data } = await supabase
      .from("latino_episodes" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setEpisodes(data);
  };

  // Debounced anime search
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (val.length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { searchAnime } = await import("@/lib/anilist");
        const result = await searchAnime(val, 1, 8);
        setSearchResults(result.media || []);
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
    // Check episodes for this slug
    checkEpisodeStatuses(slug);
  };

  const checkEpisodeStatuses = async (slug: string) => {
    setCheckingStatus(true);
    const { data } = await supabase
      .from("latino_episodes" as any)
      .select("*")
      .eq("slug", slug)
      .order("episode_number", { ascending: true });
    setEpisodeStatuses(data || []);
    setCheckingStatus(false);
  };

  const registerEpisode = async () => {
    if (!selectedAnime?.slug || !epNumber.trim()) return toast.error("Selecciona anime y número de episodio");
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const res = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/upload-hls`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.data.session?.access_token}`,
          },
          body: JSON.stringify({
            slug: selectedAnime.slug,
            episode_number: parseInt(epNumber),
            action: "register",
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.message);
      toast.success(`EP ${epNumber} de ${selectedAnime.title} registrado`);
      setEpNumber("");
      loadEpisodes();
      checkEpisodeStatuses(selectedAnime.slug);
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoading(false);
  };

  const addServer = async () => {
    if (!selectedAnime?.slug || !epNumber.trim() || !newServerUrl.trim()) return toast.error("Completa todos los campos");
    setLoading(true);
    try {
      // Get current episode data
      const { data: existing } = await supabase
        .from("latino_episodes" as any)
        .select("*")
        .eq("slug", selectedAnime.slug)
        .eq("episode_number", parseInt(epNumber))
        .maybeSingle();

      if (!existing) {
        toast.error("Primero registra el episodio");
        setLoading(false);
        return;
      }

      const currentSources = (existing as any).sources || { hls: [] };
      const hlsList = currentSources.hls || [];
      if (!hlsList.includes(newServerUrl.trim())) {
        hlsList.push(newServerUrl.trim());
      }

      await supabase
        .from("latino_episodes" as any)
        .update({ sources: { hls: hlsList } } as any)
        .eq("id", (existing as any).id);

      toast.success("Server agregado");
      setNewServerUrl("");
      loadEpisodes();
      checkEpisodeStatuses(selectedAnime.slug);
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoading(false);
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-600",
    uploading: "bg-blue-600",
    uploaded: "bg-green-600",
    error: "bg-destructive",
  };

  const isEpAlreadyUploaded = selectedAnime && epNumber
    ? episodeStatuses.some((ep: any) => ep.episode_number === parseInt(epNumber) && ep.status === "uploaded")
    : false;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Upload className="w-4 h-4 text-green-400" /> Registrar Episodio Latino HLS
      </h3>

      {/* Anime search */}
      <div className="relative">
        <label className="text-[10px] text-primary mb-1 block">Buscar anime</label>
        {selectedAnime ? (
          <div className="flex items-center gap-3 bg-secondary rounded-xl p-3 border border-primary/30">
            {selectedAnime.cover && <img src={selectedAnime.cover} alt="" className="w-10 h-14 rounded object-cover" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{selectedAnime.title}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{selectedAnime.slug}</p>
            </div>
            <button onClick={() => { setSelectedAnime(null); setEpisodeStatuses([]); }} className="text-muted-foreground hover:text-destructive">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar anime por nombre..."
                className="pl-10 h-10 bg-secondary border-primary/30 rounded-xl"
              />
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

      {/* Episode number + actions */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-primary mb-1 block">Nro. Episodio</label>
          <Input
            type="number"
            value={epNumber}
            onChange={(e) => setEpNumber(e.target.value)}
            placeholder="1"
            className="h-10 bg-secondary border-primary/30 rounded-xl"
          />
        </div>
        <div className="flex items-end">
          {isEpAlreadyUploaded && (
            <span className="text-[10px] text-yellow-400 font-medium pb-2">⚠️ Ya subido</span>
          )}
        </div>
      </div>

      <button
        onClick={registerEpisode}
        disabled={loading || !selectedAnime}
        className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} 📤 Registrar Episodio HLS
      </button>

      {/* Add extra server */}
      {selectedAnime && (
        <div className="border border-border rounded-xl p-3 space-y-2">
          <label className="text-[10px] text-primary block">➕ Agregar server extra (URL HLS)</label>
          <Input
            value={newServerUrl}
            onChange={(e) => setNewServerUrl(e.target.value)}
            placeholder="https://cdn.example.com/anime/slug/1/master.m3u8"
            className="h-10 bg-secondary border-primary/30 rounded-xl font-mono text-xs"
          />
          <button
            onClick={addServer}
            disabled={loading || !epNumber}
            className="w-full py-2 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar Server
          </button>
        </div>
      )}

      {/* Episode statuses for selected anime */}
      {selectedAnime && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-foreground">Estado de episodios: {selectedAnime.title}</h4>
            <button onClick={() => checkEpisodeStatuses(selectedAnime.slug)} className="text-[10px] text-primary">
              🔄 Actualizar
            </button>
          </div>
          {checkingStatus ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : episodeStatuses.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-4">Sin episodios registrados para este anime</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {episodeStatuses.map((ep: any) => (
                <div key={ep.id} className={`rounded-lg p-2 text-center ${ep.status === "uploaded" ? "bg-green-600/20 border border-green-600/30" : "bg-yellow-600/20 border border-yellow-600/30"}`}>
                  <p className="text-xs font-bold text-foreground">EP {ep.episode_number}</p>
                  <p className="text-[10px] text-muted-foreground">{ep.status === "uploaded" ? "✓" : "⏳"} {ep.sources?.hls?.length || 0} srv</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All registered episodes list */}
      <div className="mt-4">
        <h4 className="text-xs font-bold text-foreground mb-2">Últimos episodios registrados</h4>
        {episodes.length === 0 ? (
          <p className="text-[10px] text-muted-foreground text-center py-4">No hay episodios latinos registrados</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {episodes.map((ep: any) => (
              <div key={ep.id} className="flex items-center justify-between bg-secondary rounded-lg p-3 border border-border">
                <div>
                  <p className="text-xs font-bold text-foreground">{ep.slug} - EP {ep.episode_number}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {ep.sources?.hls?.length || 0} server(s)
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] text-white font-bold ${statusColors[ep.status] || "bg-muted"}`}>
                  {ep.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== R2 SETTINGS ==========
function R2SettingsTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("app_settings" as any)
      .select("key, value")
      .in("key", ["R2_ACCOUNT_ID", "R2_ACCESS_KEY", "R2_SECRET_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"]);
    const cfg: Record<string, string> = {};
    (data || []).forEach((s: any) => { cfg[s.key] = s.value || ""; });
    setSettings(cfg);
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from("app_settings" as any).update({ value } as any).eq("key", key);
    }
    setSaving(false);
    toast.success("Configuración R2 guardada");
  };

  const fields = [
    { key: "R2_ACCOUNT_ID", label: "Account ID", type: "text" },
    { key: "R2_ACCESS_KEY", label: "Access Key", type: "password" },
    { key: "R2_SECRET_KEY", label: "Secret Key", type: "password" },
    { key: "R2_BUCKET_NAME", label: "Bucket Name", type: "text" },
    { key: "R2_PUBLIC_URL", label: "Public URL", type: "text" },
  ];

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Settings className="w-4 h-4 text-primary" /> Configuración Cloudflare R2
      </h3>
      <p className="text-[10px] text-muted-foreground">
        Configura las credenciales de R2 para subir episodios HLS. Los valores se almacenan de forma segura.
      </p>

      {fields.map((f) => (
        <div key={f.key}>
          <label className="text-[10px] text-primary mb-1 block">{f.label}</label>
          <Input
            type={f.type}
            value={settings[f.key] || ""}
            onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })}
            placeholder={f.label}
            className="h-10 bg-secondary border-primary/30 rounded-xl font-mono text-xs"
          />
        </div>
      ))}

      <button
        onClick={saveSettings}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-primary/80 text-primary-foreground font-bold text-sm hover:bg-primary transition flex items-center justify-center gap-2"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} 💾 Guardar Configuración R2
      </button>
    </div>
  );
}

// ========== PREMIUM ==========
function PremiumTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    supabase.from("premium_requests").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setRequests(data);
    });
  }, []);

  const approve = async (req: any) => {
    await supabase.from("user_roles").insert({ user_id: req.user_id, role: "premium" as any });
    const expires = req.membership_type === "annual" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null;
    await supabase.from("premium_memberships").insert({
      user_id: req.user_id, membership_type: req.membership_type, status: "active" as any,
      activated_at: new Date().toISOString(), expires_at: expires,
    });
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
        { key: "price_lifetime", label: "Precio Vitalicio" },
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

// ========== NOTIFS ==========
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
    setTitle(""); setMessage("");
    toast.success("Notificación enviada a todos");
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
