import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import ProfileSelector from "./ProfileSelector";
import PinPrompt from "./PinPrompt";
import DeviceLimitModal from "./DeviceLimitModal";
import {
  isProfilePinValid, getActiveProfileId, setActiveProfileId,
  type AccountProfile,
} from "@/lib/account-profiles";
import { registerCurrentDevice } from "@/lib/devices";

const SKIP_PATHS = ["/auth", "/reset-password", "/download"];

export default function ProfileGate() {
  const location = useLocation();
  const { user, isPremium, loading: authLoading } = useAuth();
  const { profiles, loading: profilesLoading, refresh, selectProfile } = useProfiles();

  const [pendingProfile, setPendingProfile] = useState<AccountProfile | null>(null);
  const [deviceCheck, setDeviceCheck] = useState<{ allowed: boolean; current: number; limit: number } | null>(null);

  const skip = SKIP_PATHS.some((p) => location.pathname.startsWith(p));

  // Registrar dispositivo y verificar límite
  useEffect(() => {
    if (!user || authLoading || skip) return;
    (async () => {
      const result = await registerCurrentDevice(user.id, isPremium);
      setDeviceCheck(result);
    })();
  }, [user, isPremium, authLoading, skip]);

  // Refrescar perfiles cuando cambia el usuario
  useEffect(() => { if (user) refresh(); }, [user, refresh]);

  if (skip || !user || authLoading) return null;

  // 1) Bloqueo por dispositivos
  if (deviceCheck && !deviceCheck.allowed) {
    return <DeviceLimitModal current={deviceCheck.current} limit={deviceCheck.limit} />;
  }

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
  const activeId = getActiveProfileId();
  const activeProfile = activeId ? profiles.find((p) => p.id === activeId) : null;
  if (activeProfile && activeProfile.pin_enabled && !isProfilePinValid(activeProfile.id)) {
    return (
      <PinPrompt
        profile={activeProfile}
        onSuccess={() => { /* validado, dejar continuar */ setPendingProfile(null); }}
        onCancel={() => { setActiveProfileId(null); }}
      />
    );
  }

  // 4) Selector tras login si no hay activo y ya hay perfiles creados
  if (!profilesLoading && profiles.length > 0 && !activeId) {
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

  // 5) Si no tiene perfiles aún, mostrar selector para crear el primero
  if (!profilesLoading && profiles.length === 0) {
    return <ProfileSelector manageMode />;
  }

  return null;
}
