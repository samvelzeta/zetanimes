import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import ProfileSelector from "./ProfileSelector";
import PinPrompt from "./PinPrompt";
import DeviceLimitModal from "./DeviceLimitModal";
import {
  isProfilePinValid, getActiveProfileId, setActiveProfileId,
  ensureMainProfile,
  type AccountProfile,
} from "@/lib/account-profiles";
import { registerCurrentDevice } from "@/lib/devices";

const SKIP_PATHS = ["/auth", "/reset-password", "/download"];

export default function ProfileGate() {
  const location = useLocation();
  const { user, isPremium, isOwner, isAdmin, loading: authLoading } = useAuth();
  const { profiles, loading: profilesLoading, refresh, selectProfile } = useProfiles();

  const [pendingProfile, setPendingProfile] = useState<AccountProfile | null>(null);
  const [deviceCheck, setDeviceCheck] = useState<{ allowed: boolean; current: number; limit: number } | null>(null);
  const autoCreatingRef = useRef(false);
  const [ensuringMainProfile, setEnsuringMainProfile] = useState(false);
  const [deviceChecked, setDeviceChecked] = useState(false);

  const skip = SKIP_PATHS.some((p) => location.pathname.startsWith(p));
  const isProfileRoute = location.pathname.startsWith("/profile");

  const checkCurrentDevice = async () => {
    if (!user || authLoading || skip) return;
    const result = await registerCurrentDevice(user.id, isPremium, isOwner || isAdmin);
    setDeviceCheck(result);
    setDeviceChecked(true);
  };

  // Registrar dispositivo y verificar límite
  useEffect(() => {
    checkCurrentDevice();
  }, [user, isPremium, isOwner, isAdmin, authLoading, skip, location.pathname]);

  useEffect(() => {
    const onDevicesUpdated = () => checkCurrentDevice();
    window.addEventListener("zet:device-sessions-updated", onDevicesUpdated);
    return () => window.removeEventListener("zet:device-sessions-updated", onDevicesUpdated);
  }, [user, isPremium, isOwner, isAdmin, authLoading, skip]);

  useEffect(() => {
    if (!user || skip) {
      setDeviceCheck(null);
      setDeviceChecked(false);
    }
  }, [user, skip]);

  // Refrescar perfiles cuando cambia el usuario
  useEffect(() => { if (user) refresh(); }, [user, refresh]);

  // Auto-crear SOLO el perfil madre. Los perfiles hijos quedan como espacios vacíos.
  useEffect(() => {
    if (!user || profilesLoading || autoCreatingRef.current) return;
    if (profiles.length === 0) {
      autoCreatingRef.current = true;
      setEnsuringMainProfile(true);
      const baseName = (user.user_metadata?.username as string) || (user.email?.split("@")[0]) || "Principal";
      ensureMainProfile(user.id, { name: baseName.slice(0, 20), avatar_url: null })
        .then(() => refresh())
        .catch(() => {})
        .finally(() => { autoCreatingRef.current = false; setEnsuringMainProfile(false); });
    }
  }, [user, profiles.length, profilesLoading, refresh]);

  const activeId = getActiveProfileId();
  const activeProfile = useMemo(
    () => (activeId ? profiles.find((p) => p.id === activeId) || null : null),
    [activeId, profiles]
  );

  if (skip || !user || authLoading) return null;
  if (profilesLoading || ensuringMainProfile || profiles.length === 0 || !deviceChecked) return null;

  // 1) Bloqueo por dispositivos
  if (deviceCheck && !deviceCheck.allowed && !isProfileRoute) {
    return <DeviceLimitModal current={deviceCheck.current} limit={deviceCheck.limit} />;
  }

  // En /profile siempre dejamos pasar: ahí es donde se cierran sesiones/dispositivos.
  if (isProfileRoute) return null;

  // 2) PIN del perfil pendiente (cuando seleccionamos uno protegido)
  if (pendingProfile) {
    return (
      <PinPrompt
        profile={pendingProfile}
        onSuccess={() => {
          selectProfile(pendingProfile.id);
          setPendingProfile(null);
        }}
        onCancel={() => setPendingProfile(null)}
      />
    );
  }

  // 3) Si hay un perfil activo y tiene PIN, validarlo si la sesión expiró
  if (activeProfile && activeProfile.pin_enabled && !isProfilePinValid(activeProfile.id)) {
    return (
      <PinPrompt
        profile={activeProfile}
        onSuccess={() => { setPendingProfile(null); }}
        onCancel={() => { setActiveProfileId(null); }}
      />
    );
  }

  // 4) Selector tras login si no hay activo y ya hay perfiles creados.
  //    AuthContext limpia "zet:active-profile-id" en cada SIGNED_IN, así que
  //    siempre que entren con email+contraseña verán "¿Quién está viendo?"
  if (profiles.length > 0 && !activeId) {
    return (
      <ProfileSelector
        onPick={(p) => {
          if (p.pin_enabled && !isProfilePinValid(p.id)) {
            setPendingProfile(p);
          } else {
            selectProfile(p.id);
          }
        }}
      />
    );
  }

  return null;
}
