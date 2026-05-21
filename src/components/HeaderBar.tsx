import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { Bell, X, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ProfileSelector from "@/components/profiles/ProfileSelector";

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
      <div className="flex items-center gap-2">
        <Link to={user ? "/profile" : "/auth"} className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-primary/30 flex-shrink-0">
          {activeProfile?.avatar_url || profile?.avatar_url ? (
            <img src={activeProfile?.avatar_url || profile?.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: activeProfile?.accent_color || "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
              <span className="text-xs font-black text-white">{(activeProfile?.name || profile?.username)?.[0]?.toUpperCase() || "Z"}</span>
            </div>
          )}
        </Link>
        {user && profiles.length > 0 && (
          <button
            onClick={() => setShowProfileSwitcher(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/60 hover:bg-secondary text-[10px] font-bold text-foreground transition"
            title="Cambiar perfil"
          >
            <Users className="w-3 h-3" />
            {activeProfile?.name || "Perfil"}
          </button>
        )}
      </div>

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
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">No hay notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.filter((n) => !dismissed.has(n.id)).map((n) => {
                  const isUnread = unread.some((item) => item.id === n.id);
                  return (
                  <div key={n.id} className={`p-3 flex items-start gap-2 ${typeColors[n.type] || typeColors.info} border-l-2 ${isUnread ? "" : "opacity-70"}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold flex items-center gap-2">{n.title}{isUnread && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}</p>
                      <p className="text-[10px] opacity-80 mt-0.5">{n.message}</p>
                    </div>
                    <button onClick={() => dismissNotif(n.id)} className="flex-shrink-0 hover:opacity-70"><X className="w-3 h-3" /></button>
                  </div>
                )})}
              </div>
            )}
          </div>
        )}
      </div>

      {showProfileSwitcher && <ProfileSelector onClose={() => setShowProfileSwitcher(false)} />}
    </div>
  );
}
