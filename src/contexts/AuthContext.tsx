import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { getDeviceId } from "@/lib/device-id";
import { isCurrentDeviceSessionValid, touchCurrentDevice } from "@/lib/devices";
import { clearAllProfilePins, setActiveProfileId } from "@/lib/account-profiles";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  roles: string[];
  isPremium: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, profile: null, roles: [], isPremium: false, isOwner: false, isAdmin: false, loading: true,
  signOut: async () => {}, refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const revokedByRemoteRef = useRef(false);

  const fetchProfile = async (userId: string) => {
    const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
    setProfile(prof);
    const { data: userRoles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles(userRoles?.map((r) => r.role) || []);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const clearLocalAuthState = () => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    try {
      setActiveProfileId(null);
      clearAllProfilePins();
      sessionStorage.removeItem("zet:pin-session-ok");
    } catch {}
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // El perfil elegido vive en sessionStorage: se mantiene al cambiar de app/pestaña,
        // pero se limpia solo cuando se cierra por completo el navegador/WebView.
        // Use setTimeout to avoid potential deadlocks with Supabase client
        setTimeout(() => fetchProfile(session.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
      setLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime: si el owner cambia mis roles (ascenso a admin/premium o degradación),
  // se refrescan automáticamente sin tener que cerrar sesión.
  useEffect(() => {
    if (!user || roles.includes("owner")) return;
    const channel = supabase
      .channel(`user-roles-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => { fetchProfile(user.id); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, roles]);

  // Refresca roles cuando la pestaña vuelve a estar visible (cubre TVs/APK que tardan en propagar realtime)
  useEffect(() => {
    if (!user || roles.includes("owner")) return;
    const onVisible = () => { if (document.visibilityState === "visible") fetchProfile(user.id); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user, roles]);

  useEffect(() => {
    if (!user) return;
    const currentDeviceId = getDeviceId();
    const channel = supabase
      .channel(`device-session-${user.id}-${currentDeviceId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "device_sessions", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const updated = payload.new as { device_id?: string; revoked_at?: string | null } | null;
          if (updated?.device_id === currentDeviceId && updated.revoked_at) {
            revokedByRemoteRef.current = true;
            await supabase.auth.signOut();
            clearLocalAuthState();
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const valid = await isCurrentDeviceSessionValid(user.id);
      if (!valid) {
        revokedByRemoteRef.current = true;
        await supabase.auth.signOut();
        clearLocalAuthState();
      } else {
        await touchCurrentDevice(user.id);
      }
    };
    const interval = window.setInterval(check, 15000);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  const isPremium = roles.includes("premium") || roles.includes("owner");
  const isOwner = roles.includes("owner");
  // Owner es siempre admin también; admin explícito tiene acceso al panel pero NO a áreas owner-only.
  const isAdmin = isOwner || roles.includes("admin");

  const signOut = async () => {
    await supabase.auth.signOut();
    clearLocalAuthState();
    revokedByRemoteRef.current = false;
  };

  useEffect(() => {
    if (!revokedByRemoteRef.current) return;
    revokedByRemoteRef.current = false;
    try {
      localStorage.removeItem("zet:active-profile-id");
      setActiveProfileId(null);
      clearAllProfilePins();
      sessionStorage.removeItem("zet:pin-session-ok");
    } catch {}
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, isPremium, isOwner, isAdmin, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
