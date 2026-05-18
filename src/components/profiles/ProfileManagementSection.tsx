import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { Users, Smartphone, Loader2, Trash2, Plus, KeyRound, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getDeviceLimit, listMyDevices, revokeAllDevices, revokeDevice, type DeviceSession } from "@/lib/devices";
import { getDeviceId } from "@/lib/device-id";
import { getMaxProfiles } from "@/lib/account-profiles";
import ProfileSelector from "./ProfileSelector";

export default function ProfileManagementSection() {
  const { user, isPremium, isOwner, isAdmin, signOut } = useAuth();
  const { profiles, refresh } = useProfiles();
  const [showProfileMgmt, setShowProfileMgmt] = useState(false);
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const currentDeviceId = getDeviceId();
  const premiumAccess = isPremium || isOwner;
  const unlimitedDevices = isOwner || isAdmin;
  const deviceLimit = getDeviceLimit(isPremium, unlimitedDevices);
  const maxProfiles = getMaxProfiles(premiumAccess);
  const profilesWithPin = profiles.filter((p) => p.pin_enabled).length;

  useEffect(() => { if (user) loadDevices(); }, [user]);

  const loadDevices = async () => {
    if (!user) return;
    setLoadingDevices(true);
    const dev = await listMyDevices(user.id);
    setDevices(dev);
    setLoadingDevices(false);
  };

  const handleRevoke = async (deviceId: string) => {
    if (!user) return;
    await revokeDevice(user.id, deviceId);
    toast.success(deviceId === currentDeviceId ? "Sesión cerrada en este dispositivo" : "Dispositivo desconectado");
    if (deviceId === currentDeviceId) {
      await signOut();
      return;
    }
    await loadDevices();
    window.dispatchEvent(new Event("zet:device-sessions-updated"));
  };

  const handleRevokeAll = async () => {
    if (!user || devices.length === 0) return;
    await revokeAllDevices(user.id);
    toast.success("Todas las sesiones fueron cerradas");
    await signOut();
  };

  if (!user) return null;

  return (
    <div className="space-y-2.5 mt-4">
      {/* Perfiles */}
      <button
        onClick={() => setShowProfileMgmt(true)}
        className="w-full group flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/60 border border-border hover:border-primary/50 hover:bg-secondary transition-all"
      >
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Users className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            Perfiles ({profiles.length}/{maxProfiles})
            {profilesWithPin > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] text-primary font-black uppercase">
                <KeyRound className="w-2.5 h-2.5" /> {profilesWithPin} con PIN
              </span>
            )}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Hasta {maxProfiles} perfiles {premiumAccess ? "(Premium)" : "(Gratis · sube a Premium para 3)"} · PIN individual
          </p>
        </div>
        <Plus className="w-4 h-4 text-primary" />
      </button>

      {/* Dispositivos */}
      <div className="rounded-xl bg-secondary/60 border border-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Dispositivos conectados ({devices.length}/{deviceLimit})</p>
            <p className="text-[10px] text-muted-foreground">{unlimitedDevices ? "Admin · sin bloqueo" : premiumAccess ? "Premium · 5 dispositivos" : "Gratis · 1 dispositivo"}</p>
          </div>
          {devices.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={loadDevices}
                disabled={loadingDevices}
                className="h-7 w-7 rounded-md border border-border text-foreground hover:border-primary hover:text-primary disabled:opacity-50 transition flex items-center justify-center"
                title="Actualizar dispositivos"
                aria-label="Actualizar dispositivos"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDevices ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={handleRevokeAll}
                className="px-2.5 py-1.5 rounded-md border border-border text-[10px] font-bold text-foreground hover:border-primary hover:text-primary transition"
              >
                Cerrar todas
              </button>
            </div>
          )}
        </div>

        {loadingDevices ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
        ) : devices.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Sin dispositivos registrados</p>
        ) : (
          <div className="space-y-1.5">
            {devices.map((d) => (
              <div key={d.id} className={`flex items-center gap-2 p-2 rounded-lg ${d.device_id === currentDeviceId ? "bg-primary/10 border border-primary/30" : "bg-background/50 border border-border"}`}>
                <Smartphone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {d.device_name || "Dispositivo"}
                    {d.device_id === currentDeviceId && <span className="ml-2 text-[9px] text-primary font-black">ACTUAL</span>}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {d.platform} · {new Date(d.last_active_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(d.device_id)}
                  className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition"
                  title="Desconectar"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!premiumAccess && devices.length > deviceLimit && (
          <div className="mt-3 p-2.5 rounded-lg bg-primary/10 border border-primary/30 text-[10px] text-primary flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Hay más dispositivos de los permitidos. Cierra el otro dispositivo aquí o sube a Premium para conectar hasta 5.
          </div>
        )}
      </div>

      {showProfileMgmt && <ProfileSelector manageMode onClose={() => { setShowProfileMgmt(false); refresh(); }} />}
    </div>
  );
}
