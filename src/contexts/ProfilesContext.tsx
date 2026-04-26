import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  type AccountProfile,
  listProfiles,
  getActiveProfileId,
  setActiveProfileId as persistActive,
} from "@/lib/account-profiles";

interface ProfilesContextType {
  profiles: AccountProfile[];
  activeProfile: AccountProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  selectProfile: (id: string | null) => void;
}

const ProfilesContext = createContext<ProfilesContextType>({
  profiles: [],
  activeProfile: null,
  loading: true,
  refresh: async () => {},
  selectProfile: () => {},
});

export const useProfiles = () => useContext(ProfilesContext);

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<AccountProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(getActiveProfileId());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfiles([]);
      persistActive(null);
      setActiveId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await listProfiles(user.id);
    setProfiles(list);
    // Si el activo ya no existe, limpiar
    const stored = getActiveProfileId();
    if (stored && !list.find((p) => p.id === stored)) {
      persistActive(null);
      setActiveId(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => setActiveId(getActiveProfileId());
    window.addEventListener("zet:active-profile-changed", onChange);
    return () => window.removeEventListener("zet:active-profile-changed", onChange);
  }, []);

  const selectProfile = (id: string | null) => {
    persistActive(id);
    setActiveId(id);
  };

  const activeProfile = profiles.find((p) => p.id === activeId) || null;

  return (
    <ProfilesContext.Provider value={{ profiles, activeProfile, loading, refresh, selectProfile }}>
      {children}
    </ProfilesContext.Provider>
  );
}
