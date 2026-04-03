import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, BarChart3, Crown, Image, Store, CreditCard,
  Bell, MessageSquare, Users, Shield, X, Loader2, Search,
  Trash2, Pencil, Plus, ExternalLink, Key, Link2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import DownloadTracker from "@/components/admin/DownloadTracker";

const TABS = [
  { key: "stats", label: "Stats", icon: BarChart3 },
  { key: "downloads", label: "Descargas", icon: Store },
  { key: "override", label: "Override URL", icon: Link2 },
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
        {tab === "override" && <OverrideURLTab />}
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
  const [epNumber, setEpNumber] = useState("");
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
    if (!selectedAnime?.slug || !epNumber.trim() || !overrideUrl.trim()) return toast.error("Completa todos los campos");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("https://zetapi-api.samvelzeta.workers.dev/api/admin/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selectedAnime.slug,
          number: parseInt(epNumber),
          url: overrideUrl.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult("✅ Override registrado correctamente");
        toast.success("Override enviado");
        setEpNumber("");
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
        <label className="text-[10px] text-primary mb-1 block">Nro. Episodio</label>
        <Input type="number" value={epNumber} onChange={(e) => setEpNumber(e.target.value)} placeholder="1" className="h-10 bg-secondary border-primary/30 rounded-xl" />
      </div>

      <div>
        <label className="text-[10px] text-primary mb-1 block">URL directa del episodio</label>
        <Input value={overrideUrl} onChange={(e) => setOverrideUrl(e.target.value)} placeholder="https://jkanime.net/anime-slug/1/"
          className="h-10 bg-secondary border-primary/30 rounded-xl font-mono text-xs" />
      </div>

      <button onClick={sendOverride} disabled={loading || !selectedAnime || !epNumber || !overrideUrl}
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
