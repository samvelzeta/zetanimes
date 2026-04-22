import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import {
  Users, Smartphone, KeyRound, Loader2, Trash2, Crown, Lock, Plus, Pencil, ShieldCheck, ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import { listMyDevices, revokeDevice, type DeviceSession } from "@/lib/devices";
import { getDeviceId } from "@/lib/device-id";
import { getAccountSettings, enablePin, disablePin } from "@/lib/account-pin";
import ProfileSelector from "./ProfileSelector";

export default function ProfileManagementSection() {
  const { user, isPremium } = useAuth();
  const { profiles, refresh } = useProfiles();
  const [showProfileMgmt, setShowProfileMgmt] = useState(false);
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [showPinForm, setShowPinForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const currentDeviceId = getDeviceId();
  const deviceLimit = isPremium ? 5 : 2;

  useEffect(() => { if (user) loadAll(); }, [user]);

  const loadAll = async () => {
    if (!user) return;
    setLoadingDevices(true);
    const [dev, settings] = await Promise.all([
      listMyDevices(user.id),
      getAccountSettings(user.id),
    ]);
    setDevices(dev);
    setPinEnabled(settings.pin_enabled);
    setLoadingDevices(false);
  };

  const handleRevoke = async (deviceId: string) => {
    if (!user) return;
    if (deviceId === currentDeviceId) {
      if (!confirm("¿Cerrar sesión en este dispositivo?")) return;
    }
    await revokeDevice(user.id, deviceId);
    toast.success("Dispositivo desconectado");
    loadAll();
  };

  const handleTogglePin = async () => {
    if (!user) return;
    if (!isPremium) {
      toast.error("PIN solo para premium");
      return;
    }
    if (pinEnabled) {
      if (!confirm("¿Desactivar el PIN de la cuenta?")) return;
      setBusy(true);
      try {
        await disablePin(user.id);
        setPinEnabled(false);
        toast.success("PIN desactivado");
      } finally { setBusy(false); }
    } else {
      setShowPinForm(true);
    }
  };

  const handleSavePin = async () => {
    if (!user || !/^\d{4}$/.test(pinInput)) {
      toast.error("PIN debe ser 4 dígitos");
      return;
    }
    setBusy(true);
    try {
      await enablePin(user.id, pinInput);
      setPinEnabled(true);
      setShowPinForm(false);
      setPinInput("");
      toast.success("PIN activado");
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally { setBusy(false); }
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
          <p className="text-sm font-bold text-foreground">Perfiles ({profiles.length}/5)</p>
          <p className="text-[10px] text-muted-foreground">Crea hasta 5 perfiles. Cada uno con su historial y listas.</p>
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
            <p className="text-[10px] text-muted-foreground">{isPremium ? "Premium · 5 dispositivos" : "Gratis · 2 dispositivos"}</p>
          </div>
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

        {!isPremium && devices.length >= deviceLimit && (
          <div className="mt-3 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-[10px] text-yellow-300 flex items-center gap-2">
            <Crown className="w-3.5 h-3.5" />
            Hazte Premium para conectar hasta 5 dispositivos
          </div>
        )}
      </div>

      {/* PIN */}
      <div className="rounded-xl bg-secondary/60 border border-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              PIN de la cuenta
              {!isPremium && <Lock className="w-3 h-3 text-yellow-500" />}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {pinEnabled ? "Activo · se pide al iniciar sesión" : isPremium ? "Protege tu cuenta con un PIN de 4 dígitos" : "Premium: protege tu cuenta con PIN"}
            </p>
          </div>
          <button
            onClick={handleTogglePin}
            disabled={busy || !isPremium}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition disabled:opacity-50 ${pinEnabled ? "bg-destructive/20 text-destructive hover:bg-destructive/30" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : pinEnabled ? <><ShieldOff className="w-3 h-3 inline mr-1" />Desactivar</> : <><ShieldCheck className="w-3 h-3 inline mr-1" />Activar</>}
          </button>
        </div>

        {showPinForm && (
          <div className="mt-3 p-3 rounded-lg bg-background border border-input">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              className="w-full text-center text-2xl tracking-[0.5em] font-black px-3 py-2 rounded-md bg-secondary border border-input outline-none focus:border-primary"
            />
            <div className="flex gap-2 mt-2">
              <button onClick={handleSavePin} disabled={busy} className="flex-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50">
                Guardar
              </button>
              <button onClick={() => { setShowPinForm(false); setPinInput(""); }} className="px-3 py-1.5 rounded-md bg-secondary text-xs font-bold">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {showProfileMgmt && <ProfileSelector manageMode onClose={() => { setShowProfileMgmt(false); refresh(); }} />}
    </div>
  );
}
