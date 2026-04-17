import { useAuth } from "@/contexts/AuthContext";
import { Bell, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
}

export default function HeaderBar() {
  const { user, profile, refreshProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const fetchNotifs = async () => {
      const { data } = await supabase.from("notifications").select("*").eq("active", true).order("created_at", { ascending: false }).limit(10);
      if (data) setNotifications(data);
    };
    fetchNotifs();

    const channel = supabase.channel("notifications-realtime").on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications" },
      (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (user) {
      supabase.from("notification_dismissals").select("notification_id").eq("user_id", user.id).then(({ data }) => {
        if (data) setDismissed(new Set(data.map((d) => d.notification_id)));
      });
    }
  }, [user]);

  useEffect(() => {
    if (profile?.last_seen_notification_id) setLastSeenAt(profile.last_seen_notification_id);
  }, [profile]);

  const unread = notifications.filter((n) => {
    if (dismissed.has(n.id)) return false;
    if (lastSeenAt && new Date(n.created_at) <= new Date(lastSeenAt)) return false;
    return true;
  });
  const hasUnread = unread.length > 0;

  const markAllSeen = async () => {
    if (!user || notifications.length === 0) return;
    const newest = notifications[0].created_at;
    setLastSeenAt(newest);
    await supabase.from("profiles").update({ last_seen_notification_id: newest }).eq("user_id", user.id);
    refreshProfile();
  };

  const handleToggleNotifs = () => {
    const opening = !showNotifs;
    setShowNotifs(opening);
    if (opening && hasUnread) markAllSeen();
  };

  const dismissNotif = async (notifId: string) => {
    if (user) {
      await supabase.from("notification_dismissals").insert({ user_id: user.id, notification_id: notifId });
    }
    setDismissed((prev) => new Set(prev).add(notifId));
  };

  const typeColors: Record<string, string> = {
    danger: "bg-destructive/10 border-destructive/30 text-destructive",
    warning: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    success: "bg-green-500/10 border-green-500/30 text-green-400",
    info: "bg-primary/10 border-primary/30 text-primary",
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 glass-header transition-all duration-300 ${scrolled ? "scrolled" : ""}`}>
      <Link to={user ? "/profile" : "/auth"} className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-primary/30 flex-shrink-0">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <span className="text-xs font-black text-white">{profile?.username?.[0]?.toUpperCase() || "Z"}</span>
          </div>
        )}
      </Link>

      <Link to="/" className="text-sm font-black text-foreground tracking-tight drop-shadow-md">ZetAnime</Link>

      <div className="relative">
        <button onClick={handleToggleNotifs} className="w-8 h-8 rounded-full bg-secondary/80 backdrop-blur flex items-center justify-center hover:bg-muted transition relative">
          <Bell className="w-4 h-4 text-foreground" />
          {hasUnread && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />}
        </button>

        {showNotifs && (
          <div className="absolute right-0 top-10 w-80 max-h-96 overflow-y-auto bg-card border border-border rounded-xl shadow-xl z-50">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Notificaciones</span>
              <button onClick={() => setShowNotifs(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            {unread.length === 0 ? (
              <div className="p-6 text-center">
                {!user ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Inicia sesión para ver notificaciones</p>
                    <Link to="/auth" className="text-xs text-primary font-bold hover:underline" onClick={() => setShowNotifs(false)}>Iniciar sesión →</Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay notificaciones nuevas</p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {unread.map((n) => (
                  <div key={n.id} className={`p-3 flex items-start gap-2 ${typeColors[n.type] || typeColors.info} border-l-2`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold">{n.title}</p>
                      <p className="text-[10px] opacity-80 mt-0.5">{n.message}</p>
                    </div>
                    <button onClick={() => dismissNotif(n.id)} className="flex-shrink-0 hover:opacity-70"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
