import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

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

  const fetchProfile = async (userId: string) => {
    const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
    setProfile(prof);
    const { data: userRoles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles(userRoles?.map((r) => r.role) || []);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // En cada login fresco (o token refrescado tras re-login), forzar selector de perfil:
        // limpiamos el perfil activo guardado y los PINs de sesión para que el gate muestre
        // siempre la pantalla "¿Quién está viendo?" (estilo Netflix).
        if (event === "SIGNED_IN") {
          try {
            localStorage.removeItem("zet:active-profile-id");
            Object.keys(sessionStorage)
              .filter((k) => k.startsWith("zet:pin-ok:"))
              .forEach((k) => sessionStorage.removeItem(k));
            window.dispatchEvent(new Event("zet:active-profile-changed"));
          } catch {}
        }
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
    if (!user) return;
    const channel = supabase
      .channel(`user-roles-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => { fetchProfile(user.id); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Refresca roles cuando la pestaña vuelve a estar visible (cubre TVs/APK que tardan en propagar realtime)
  useEffect(() => {
    if (!user) return;
    const onVisible = () => { if (document.visibilityState === "visible") fetchProfile(user.id); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user]);

  const isPremium = roles.includes("premium") || roles.includes("owner");
  const isOwner = roles.includes("owner");
  // Owner es siempre admin también; admin explícito tiene acceso al panel pero NO a áreas owner-only.
  const isAdmin = isOwner || roles.includes("admin");

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    // Limpiar selección de perfil + todos los PINs por perfil
    try {
      localStorage.removeItem("zet:active-profile-id");
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("zet:pin-ok:") || k === "zet:pin-session-ok")
        .forEach((k) => sessionStorage.removeItem(k));
      window.dispatchEvent(new Event("zet:active-profile-changed"));
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, isPremium, isOwner, isAdmin, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
