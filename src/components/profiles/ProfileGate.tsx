import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import ProfileSelector from "./ProfileSelector";
import PinPrompt from "./PinPrompt";
import DeviceLimitModal from "./DeviceLimitModal";
import {
  isProfilePinValid, getActiveProfileId, setActiveProfileId,
  createProfile,
  type AccountProfile,
} from "@/lib/account-profiles";
import { registerCurrentDevice } from "@/lib/devices";

const SKIP_PATHS = ["/auth", "/reset-password", "/download"];

export default function ProfileGate() {
  const location = useLocation();
  const { user, isPremium, isOwner, loading: authLoading } = useAuth();
  const { profiles, loading: profilesLoading, refresh, selectProfile } = useProfiles();

  const [pendingProfile, setPendingProfile] = useState<AccountProfile | null>(null);
  const [deviceCheck, setDeviceCheck] = useState<{ allowed: boolean; current: number; limit: number } | null>(null);
  const autoCreatingRef = useRef(false);
  const [deviceChecked, setDeviceChecked] = useState(false);

  const skip = SKIP_PATHS.some((p) => location.pathname.startsWith(p));

  // Registrar dispositivo y verificar límite
  useEffect(() => {
    if (!user || authLoading || skip || isOwner) return;
    (async () => {
      const result = await registerCurrentDevice(user.id, isPremium);
      setDeviceCheck(result);
      setDeviceChecked(true);
    })();
  }, [user, isPremium, isOwner, authLoading, skip]);

  useEffect(() => {
    if (!user || skip) {
      setDeviceCheck(null);
      setDeviceChecked(false);
    }
  }, [user, skip]);

  // Refrescar perfiles cuando cambia el usuario
  useEffect(() => { if (user) refresh(); }, [user, refresh]);

  // Auto-crear el primer perfil "Principal" si la cuenta no tiene ninguno todavía.
  // (Sucede cuando el usuario recién se registra: entra y ve directamente el selector
  //  con su perfil por defecto, sin tener que rellenar nada.)
  useEffect(() => {
    if (!user || profilesLoading || autoCreatingRef.current) return;
    if (profiles.length === 0) {
      autoCreatingRef.current = true;
      const baseName = (user.user_metadata?.username as string) || (user.email?.split("@")[0]) || "Principal";
      createProfile(user.id, { name: baseName.slice(0, 20), accent_color: null, avatar_url: null, is_default: true, pin: null })
        .then(() => refresh())
        .catch(() => { /* el trigger devolverá error si supera límite */ })
        .finally(() => { autoCreatingRef.current = false; });
    }
  }, [user, profiles.length, profilesLoading, refresh]);

  const activeId = getActiveProfileId();
  const activeProfile = useMemo(
    () => (activeId ? profiles.find((p) => p.id === activeId) || null : null),
    [activeId, profiles]
  );

  if (skip || !user || authLoading || isOwner) return null;
  if (profilesLoading || !deviceChecked) return null;

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
