import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity, Filter, Trash2, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface LogRow {
  id: string;
  actor_id: string;
  actor_name: string | null;
  area: string;
  action: string;
  summary: string;
  target_type: string | null;
  anilist_id: number | null;
  anime_title: string | null;
  episode_number: number | null;
  metadata: any;
  created_at: string;
}

const AREAS = [
  { key: "all", label: "Todo" },
  { key: "tracker", label: "Descargas" },
  { key: "videos", label: "Videos" },
  { key: "slugs", label: "Slugs" },
  { key: "episodes", label: "Episodios" },
  { key: "hidden", label: "Ocultar" },
  { key: "reports", label: "Reportes" },
  { key: "apk", label: "APK" },
  { key: "notifications", label: "Notifs" },
  { key: "payments", label: "Pago" },
  { key: "roles", label: "Roles" },
];

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-500/20 text-green-400",
  update: "bg-blue-500/20 text-blue-400",
  delete: "bg-red-500/20 text-red-400",
  status_change: "bg-yellow-500/20 text-yellow-400",
  upload: "bg-purple-500/20 text-purple-400",
  mark_episode: "bg-cyan-500/20 text-cyan-400",
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `hace ${Math.floor(diff)}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

export default function ActivityLogTab() {
  const { isOwner } = useAuth();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState("all");
  const [actor, setActor] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    let query = (supabase.from("admin_activity_log") as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (area !== "all") query = query.eq("area", area);
    if (actor !== "all") query = query.eq("actor_id", actor);
    const { data, error } = await query;
    if (error) toast.error("No se pudo cargar el historial");
    setLogs((data || []) as LogRow[]);
    setLoading(false);
  }, [area, actor]);

  useEffect(() => { load(); }, [load]);

  // realtime
  useEffect(() => {
    const channel = supabase
      .channel("admin-activity-log")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_activity_log" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const actors = Array.from(new Map(logs.map((l) => [l.actor_id, l.actor_name || "Admin"])).entries());

  const clearOld = async () => {
    if (!isOwner) return;
    if (!confirm("¿Borrar registros de más de 30 días?")) return;
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const { error } = await (supabase.from("admin_activity_log") as any).delete().lt("created_at", cutoff);
    if (error) return toast.error("No se pudo limpiar");
    toast.success("Historial antiguo eliminado");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Historial de actividad</h2>
        <button onClick={load} className="ml-auto p-1.5 rounded-lg bg-secondary hover:bg-muted">
          <RefreshCw className="w-3.5 h-3.5 text-foreground" />
        </button>
        {isOwner && (
          <button onClick={clearOld} className="p-1.5 rounded-lg bg-destructive/20 hover:bg-destructive/30">
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {AREAS.map((a) => (
          <button
            key={a.key}
            onClick={() => setArea(a.key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
              area === a.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {actors.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <button
            onClick={() => setActor("all")}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${actor === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
          >
            Todos
          </button>
          {actors.map(([id, name]) => (
            <button
              key={id}
              onClick={() => setActor(id)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${actor === id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sin actividad registrada todavía.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="bg-secondary border border-border rounded-xl p-3">
              <div className="flex items-start gap-2">
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${ACTION_COLORS[l.action] || "bg-muted text-muted-foreground"}`}>
                  {l.action.toUpperCase()}
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {l.area}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(l.created_at)}</span>
              </div>
              <p className="text-xs text-foreground mt-1.5 leading-snug">{l.summary}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                por <span className="text-primary font-bold">{l.actor_name || "Admin"}</span>
                {l.anime_title && <> · <span className="font-medium">{l.anime_title}</span></>}
                {l.episode_number != null && <> · ep {l.episode_number}</>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
