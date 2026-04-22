// Página /mis-listas — separada del Perfil, estética steampunk con engranajes.
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Eye, CheckCircle, Clock, HelpCircle, Cog, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ListType } from "@/lib/anime-lists";

const TABS: { value: ListType; label: string; Icon: typeof Heart; color: string }[] = [
  { value: "favorite", label: "Favoritos", Icon: Heart, color: "text-rose-400" },
  { value: "watching", label: "Viendo", Icon: Eye, color: "text-emerald-400" },
  { value: "plan_to_watch", label: "Ver Después", Icon: Clock, color: "text-sky-400" },
  { value: "completed", label: "Terminados", Icon: CheckCircle, color: "text-primary" },
  { value: "undecided", label: "Indecisos", Icon: HelpCircle, color: "text-amber-400" },
];

export default function MyLists() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ListType>("favorite");
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<ListType, number>>({
    favorite: 0, watching: 0, completed: 0, plan_to_watch: 0, undecided: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("anime_lists").select("*").eq("user_id", user.id);
      const all = data || [];
      // Calcular conteos
      const c: Record<ListType, number> = { favorite: 0, watching: 0, completed: 0, plan_to_watch: 0, undecided: 0 };
      all.forEach((r: any) => { c[r.list_type as ListType] = (c[r.list_type as ListType] || 0) + 1; });
      setCounts(c);
      // Filtrar por tab activo
      setItems(all.filter((r: any) => r.list_type === activeTab));
      setLoading(false);
    })();
  }, [user, activeTab]);

  const removeItem = async (id: string) => {
    await supabase.from("anime_lists").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setCounts((c) => ({ ...c, [activeTab]: Math.max(0, c[activeTab] - 1) }));
    toast.success("Eliminado de la lista");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <Cog className="w-16 h-16 text-primary mb-4 animate-spin" style={{ animationDuration: "8s" }} />
        <h1 className="text-xl font-black text-foreground mb-2">Inicia sesión</h1>
        <p className="text-sm text-muted-foreground mb-4">Necesitas una cuenta para ver tus listas</p>
        <Link to="/auth" className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Iniciar Sesión</Link>
      </div>
    );
  }

  const activeTabConfig = TABS.find((t) => t.value === activeTab)!;

  return (
    <div className="min-h-screen pt-4 pb-24">
      {/* Header steampunk con engranaje giratorio */}
      <div className="relative px-4 pb-4 mb-2 border-b border-primary/20">
        <button onClick={() => navigate(-1)} className="absolute left-4 top-1 w-9 h-9 rounded-full bg-secondary/80 backdrop-blur flex items-center justify-center hover:bg-primary/20 transition" aria-label="Volver">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center justify-center gap-3 pt-1">
          <Cog className="w-7 h-7 text-primary animate-spin" style={{ animationDuration: "12s", filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.7))" }} />
          <h1 className="text-xl font-black text-foreground tracking-tight">Mis Listas</h1>
          <Cog className="w-5 h-5 text-primary/60 animate-spin" style={{ animationDuration: "8s", animationDirection: "reverse" }} />
        </div>
      </div>

      {/* Tabs steampunk con conteos */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-5 gap-1.5">
          {TABS.map(({ value, label, Icon, color }) => {
            const isActive = activeTab === value;
            const count = counts[value] || 0;
            return (
              <button key={value} onClick={() => setActiveTab(value)}
                className={`relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border-2 transition-all duration-300 ${
                  isActive
                    ? "border-primary bg-primary/10 scale-105"
                    : "border-border/50 bg-secondary/40 hover:border-primary/40"
                }`}
                style={isActive ? { boxShadow: "0 0 18px hsl(var(--primary) / 0.45), inset 0 0 12px hsl(var(--primary) / 0.1)" } : undefined}
              >
                <Icon className={`w-4 h-4 mb-1 ${isActive ? color : "text-muted-foreground"}`} />
                <span className={`text-[9px] font-bold leading-tight ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                {count > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground border border-border"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sección activa con marco steampunk */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-3">
          <activeTabConfig.Icon className={`w-4 h-4 ${activeTabConfig.color}`} />
          <h2 className="text-sm font-black text-foreground uppercase tracking-wider">{activeTabConfig.label}</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-primary/40 to-transparent" />
          <span className="text-xs text-muted-foreground font-mono">{counts[activeTab]} {counts[activeTab] === 1 ? "anime" : "animes"}</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-secondary animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Cog className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Tu lista de <span className={activeTabConfig.color}>{activeTabConfig.label}</span> está vacía</p>
            <Link to="/directory" className="mt-4 px-5 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition">
              Explorar Directorio
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {items.map((item) => (
              <div key={item.id} className="group relative">
                <Link to={`/anime/${item.anime_id}`} className="block">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-secondary ring-1 ring-border group-hover:ring-primary/60 transition-all">
                    {item.anime_cover && (
                      <img src={item.anime_cover} alt={item.anime_title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    )}
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground line-clamp-2 mt-1.5">{item.anime_title}</p>
                </Link>
                <button onClick={() => removeItem(item.id)}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/70 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive transition-all"
                  aria-label="Eliminar">
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
