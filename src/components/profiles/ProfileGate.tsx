import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import ProfileSelector from "./ProfileSelector";
import PinPrompt from "./PinPrompt";
import DeviceLimitModal from "./DeviceLimitModal";
import { getAccountSettings } from "@/lib/account-pin";
import { isPinSessionValid, getActiveProfileId } from "@/lib/account-profiles";
import { registerCurrentDevice } from "@/lib/devices";

const SKIP_PATHS = ["/auth", "/reset-password", "/download"];

export default function ProfileGate() {
  const location = useLocation();
  const { user, isPremium, loading: authLoading } = useAuth();
  const { profiles, loading: profilesLoading, refresh } = useProfiles();
  const [pinRequired, setPinRequired] = useState(false);
  const [pinChecked, setPinChecked] = useState(false);
  const [deviceCheck, setDeviceCheck] = useState<{ allowed: boolean; current: number; limit: number } | null>(null);

  const skip = SKIP_PATHS.some((p) => location.pathname.startsWith(p));

  // Chequear PIN una vez por sesión, al login
  useEffect(() => {
    if (!user || skip) { setPinChecked(true); return; }
    if (isPinSessionValid()) { setPinChecked(true); return; }
    (async () => {
      const settings = await getAccountSettings(user.id);
      setPinRequired(settings.pin_enabled && !!settings.pin_hash);
      setPinChecked(true);
    })();
  }, [user, skip]);

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

  // 2) PIN
  if (pinChecked && pinRequired) {
    return <PinPrompt userId={user.id} onSuccess={() => setPinRequired(false)} />;
  }

  // 3) Selector de perfil tras login (si no hay activo y ya hay perfiles creados)
  if (!profilesLoading && profiles.length > 0 && !getActiveProfileId()) {
    return <ProfileSelector />;
  }

  // 4) Si no tiene perfiles aún, mostrar selector para crear el primero
  if (!profilesLoading && profiles.length === 0) {
    return <ProfileSelector manageMode />;
  }

  return null;
}
