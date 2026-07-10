import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { Bell, X, Users, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ProfileSelector from "@/components/profiles/ProfileSelector";
import { useUserXP, rankColor, rankName } from "@/hooks/useUserXP";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  target_user_id?: string | null;
  image_url?: string | null;
  link?: string | null;
}

export default function HeaderBar() {
  const { user, profile, refreshProfile } = useAuth();
  const { activeProfile, profiles } = useProfiles();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  const pageTitle = location.pathname.startsWith("/directory")
    ? "Directorio de Zen"
    : location.pathname.startsWith("/recent")
    ? "Recientes"
    : location.pathname.startsWith("/search")
    ? "Buscar"
    : location.pathname.startsWith("/mylists")
    ? "Mis Listas"
    : "";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const fetchNotifs = async () => {
      // RLS ya filtra por target_user_id IS NULL OR == auth.uid()
      const { data } = await supabase.from("notifications").select("*").eq("active", true).order("created_at", { ascending: false }).limit(20);
      if (data) setNotifications(data as Notification[]);
    };
    fetchNotifs();

    const channel = supabase.channel("notifications-realtime").on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications" },
      (payload) => {
        const n = payload.new as Notification;
        // Solo aceptar globales o dirigidas a este usuario.
        if (n.target_user_id && n.target_user_id !== user?.id) return;
        setNotifications((prev) => [n, ...prev]);
      }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      supabase.from("notification_dismissals").select("notification_id").eq("user_id", user.id).then(({ data }) => {
        if (data) setDismissed(new Set(data.map((d) => d.notification_id)));
      });
    } else {
      setDismissed(new Set());
    }
  }, [user]);

  useEffect(() => {
    setLastSeenId(profile?.last_seen_notification_id || null);
  }, [profile]);

  const lastSeenIndex = lastSeenId ? notifications.findIndex((n) => n.id === lastSeenId) : -1;
  const unread = notifications.filter((n, index) => !dismissed.has(n.id) && (lastSeenIndex === -1 || index < lastSeenIndex));
  const hasUnread = unread.length > 0;

  const markAllSeen = async () => {
    if (!user || notifications.length === 0) return;
    const newest = notifications[0].id;
    setLastSeenId(newest);
    await supabase.from("profiles").update({ last_seen_notification_id: newest }).eq("user_id", user.id);
    refreshProfile();
  };

  const handleToggleNotifs = () => {
    const opening = !showNotifs;
    setShowNotifs(opening);
    if (opening && hasUnread) markAllSeen();
  };

  const [dismissing, setDismissing] = useState<Set<string>>(new Set());

  const dismissNotif = async (notifId: string) => {
    setDismissing((prev) => new Set(prev).add(notifId));
    setTimeout(async () => {
      if (user) {
        await supabase.from("notification_dismissals").insert({ user_id: user.id, notification_id: notifId });
      }
      setDismissed((prev) => new Set(prev).add(notifId));
      setDismissing((prev) => { const n = new Set(prev); n.delete(notifId); return n; });
    }, 280);
  };

  const accentHex: Record<string, string> = {
    danger: "#ff5470",
    warning: "#ffcc00",
    success: "#00ff88",
    info: "#7aa2ff",
  };

  const timeAgo = (iso: string) => {
    const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return "ahora";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 glass-header transition-all duration-300 ${scrolled ? "scrolled" : ""}`}>
      <div className="flex items-center gap-3 min-w-0">
        <Link to={user ? "/profile" : "/auth"} className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-primary/30 flex-shrink-0">
          {activeProfile?.avatar_url || profile?.avatar_url ? (
            <img src={activeProfile?.avatar_url || profile?.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: activeProfile?.accent_color || "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
              <span className="text-xs font-black text-white">{(activeProfile?.name || profile?.username)?.[0]?.toUpperCase() || "Z"}</span>
            </div>
          )}
        </Link>
        {pageTitle && (
          <span className="hidden lg:inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.35em] text-primary">
            <span className="h-px w-6 bg-primary/60" />
            {pageTitle}
          </span>
        )}
      </div>

      <div className="flex items-center gap-6 min-w-0">
        <Link to="/" className="text-sm font-black text-foreground tracking-tight drop-shadow-md flex items-center gap-2 truncate">
          <span className={pageTitle ? "hidden sm:inline" : ""}>ZetAnime</span>
          {pageTitle && (
            <span className="lg:hidden text-primary font-bold tracking-[0.2em] uppercase text-[11px]">
              <span className="hidden sm:inline text-white/40 mr-2">·</span>{pageTitle}
            </span>
          )}
        </Link>
        <nav className="hidden lg:flex items-center gap-5 text-xs font-bold">
          <Link to="/" className="text-foreground/80 hover:text-primary transition">Inicio</Link>
          <Link to="/recent" className="text-foreground/80 hover:text-primary transition">Recientes</Link>
          <Link to="/directory" className="text-foreground/80 hover:text-primary transition">Directorio</Link>
          <Link to="/ranking" className="text-foreground/80 hover:text-primary transition">Ranking</Link>
          <Link to="/search" className="text-foreground/80 hover:text-primary transition">Buscar</Link>
        </nav>
      </div>


      <div className="flex items-center gap-2">
        {user && <XPChip />}
        <div className="relative">
        <button onClick={handleToggleNotifs} className="w-8 h-8 rounded-full bg-secondary/80 backdrop-blur flex items-center justify-center hover:bg-muted transition relative">
          <Bell className="w-4 h-4 text-foreground" />
          {hasUnread && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />}
        </button>

        {showNotifs && (
          <div
            className="absolute right-0 top-10 w-[22rem] max-h-[30rem] overflow-y-auto rounded-2xl shadow-2xl z-50 animate-fade-in"
            style={{
              background: "linear-gradient(180deg, #1c1824 0%, #17141d 60%, #131019 100%)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <div className="px-4 pt-4 pb-2 sticky top-0 z-10" style={{ background: "linear-gradient(180deg, rgba(28,24,36,0.95), rgba(23,20,29,0.75))", backdropFilter: "blur(20px)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-white/60 uppercase tracking-[0.25em]">Panel de estado</span>
                <button onClick={() => setShowNotifs(false)} className="text-white/30 hover:text-white/90 transition"><X className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
              </div>
              <div className="h-px mt-3" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)" }} />
            </div>

            {notifications.filter((n) => !dismissed.has(n.id)).length === 0 ? (
              <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center border border-white/10" style={{ background: "rgba(255,255,255,0.03)", boxShadow: "inset 0 0 24px rgba(0,255,136,0.05)" }}>
                  <Sparkles className="w-5 h-5 text-white/40" />
                </div>
                <p className="text-[13px] font-semibold text-white">El cielo está despejado</p>
                <p className="text-[11px] text-[#888888]">Todo está al día</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {notifications.filter((n) => !dismissed.has(n.id)).map((n) => {
                  const isUnread = unread.some((item) => item.id === n.id);
                  const isDismissing = dismissing.has(n.id);
                  const color = accentHex[n.type] || accentHex.info;
                  const Body = (
                    <div
                      className={`group relative flex items-start gap-3 pl-4 pr-3 py-3 rounded-xl overflow-hidden transition-all duration-300 ease-out hover:bg-white/[0.06] ${n.link ? "cursor-pointer" : "cursor-default"} ${isDismissing ? "opacity-0 scale-0 blur-[10px]" : "opacity-100 scale-100 blur-0"}`}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        transitionProperty: "transform, background-color, filter, opacity",
                      }}
                    >
                      {/* Barra vertical de acento cinético */}
                      <span
                        className="absolute top-0 bottom-0 left-0 w-[3px] transition-transform duration-300 group-hover:-translate-x-[2px]"
                        style={{ background: color, boxShadow: `0 0 12px ${color}80` }}
                      />

                      {n.image_url && (
                        <img
                          src={n.image_url}
                          alt=""
                          className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                          style={{ border: `1px solid ${color}40`, boxShadow: `0 0 14px ${color}30` }}
                        />
                      )}

                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-white leading-tight flex items-start gap-2 min-w-0 flex-1">
                            <span className="break-words flex-1">{n.title}</span>
                            {isUnread && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />}
                          </p>
                          <span className="text-[10px] text-white/50 flex-shrink-0 tabular-nums mt-0.5">{timeAgo(n.created_at)}</span>
                        </div>
                        <p className="text-xs text-[#a0a0a0] mt-1 leading-[1.55] whitespace-pre-wrap break-words max-h-40 overflow-y-auto pr-1 notif-scroll">{n.message}</p>
                      </div>

                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismissNotif(n.id); }}
                        aria-label="Descartar"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white/30 hover:text-white/90"
                      >
                        <X className="w-3 h-3" strokeWidth={1.5} />
                      </button>
                    </div>
                  );
                  return n.link ? (
                    <Link key={n.id} to={n.link} onClick={() => setShowNotifs(false)} className="block">{Body}</Link>
                  ) : (
                    <div key={n.id}>{Body}</div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {showProfileSwitcher && <ProfileSelector onClose={() => setShowProfileSwitcher(false)} />}
    </div>
  );
}

function XPChip() {
  const { xp } = useUserXP();
  const color = rankColor(xp.rank_slug);
  return (
    <Link
      to="/ranking"
      className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-secondary/80 backdrop-blur border border-border hover:border-primary/40 transition"
      title={`${rankName(xp.rank_slug)} · Nivel ${xp.level} · ${xp.xp.toLocaleString()} XP · Ver ranking`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="text-[10px] font-bold tabular-nums" style={{ color }}>Nv {xp.level}</span>
    </Link>
  );
}
