import { supabase } from "@/integrations/supabase/client";
import { getDeviceInfo } from "./device-id";

const INACTIVE_HOURS = 24 * 7; // 7 días → se considera dispositivo libre

export interface DeviceSession {
  id: string;
  device_id: string;
  device_name: string | null;
  platform: string | null;
  user_agent: string | null;
  last_active_at: string;
  created_at: string;
  session_fingerprint?: string | null;
  revoked_at?: string | null;
}

async function sessionFingerprint(): Promise<string | null> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) return null;
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Registra/actualiza el dispositivo actual.
 * Devuelve { allowed: true } si entra, { allowed: false, limit, current } si supera el cupo.
 */
export async function registerCurrentDevice(userId: string, isPremium: boolean, unlimited = false): Promise<{
  allowed: boolean;
  limit: number;
  current: number;
  isCurrent?: boolean;
  revoked?: boolean;
}> {
  const limit = unlimited ? 999 : isPremium ? 5 : 1;
  const info = getDeviceInfo();
  const fingerprint = await sessionFingerprint();

  const { data: currentRows } = await supabase
    .from("device_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("device_id", info.deviceId)
    .order("last_active_at", { ascending: false })
    .limit(1);

  const currentRecord = currentRows?.[0] as DeviceSession | undefined;
  if (currentRecord?.revoked_at && (!currentRecord.session_fingerprint || currentRecord.session_fingerprint === fingerprint)) {
    return { allowed: false, limit, current: 0, isCurrent: true, revoked: true };
  }

  // 1) Listar sesiones activas (últimas N horas)
  const cutoff = new Date(Date.now() - INACTIVE_HOURS * 60 * 60 * 1000).toISOString();
  const { data: active } = await supabase
    .from("device_sessions")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gte("last_active_at", cutoff);

  const list = active || [];
  const exists = list.find((d) => d.device_id === info.deviceId);

  if (exists) {
    // Update timestamp
    await supabase.rpc("touch_device_session", {
      _user_id: userId,
      _device_id: info.deviceId,
      _session_fingerprint: fingerprint,
      _device_name: info.deviceName,
      _platform: info.platform,
      _user_agent: info.userAgent,
    });
    return { allowed: true, limit, current: list.length, isCurrent: true };
  }

  if (!unlimited && list.length >= limit) {
    return { allowed: false, limit, current: list.length };
  }

  // 2) Insertar nuevo
  await supabase.rpc("touch_device_session", {
    _user_id: userId,
    _device_id: info.deviceId,
    _session_fingerprint: fingerprint,
    _device_name: info.deviceName,
    _platform: info.platform,
    _user_agent: info.userAgent,
  });
  return { allowed: true, limit, current: list.length + 1, isCurrent: true };
}

export async function listMyDevices(userId: string): Promise<DeviceSession[]> {
  const { data } = await supabase
    .from("device_sessions")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("last_active_at", { ascending: false });
  return (data as DeviceSession[]) || [];
}

export async function revokeDevice(userId: string, deviceId: string): Promise<void> {
  await supabase.rpc("revoke_device_session", { _user_id: userId, _device_id: deviceId });
}

export async function revokeAllDevices(userId: string): Promise<void> {
  await supabase.rpc("revoke_all_device_sessions", { _user_id: userId });
}

export async function touchCurrentDevice(userId: string): Promise<void> {
  const info = getDeviceInfo();
  await supabase.rpc("touch_device_session", {
    _user_id: userId,
    _device_id: info.deviceId,
    _session_fingerprint: await sessionFingerprint(),
    _device_name: info.deviceName,
    _platform: info.platform,
    _user_agent: info.userAgent,
  });
}

export async function isCurrentDeviceSessionValid(userId: string): Promise<boolean> {
  const info = getDeviceInfo();
  // Validación basada SOLO en device_id + revoked_at.
  // (Antes se usaba un fingerprint del access_token, pero Supabase rota el token
  // cada hora y eso provocaba cierres de sesión automáticos.)
  const { data, error } = await supabase
    .from("device_sessions")
    .select("id, revoked_at")
    .eq("user_id", userId)
    .eq("device_id", info.deviceId)
    .order("last_active_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return true; // ante error de red, no cerrar sesión
  if (!data) return true; // dispositivo aún no registrado → permitir
  return !data.revoked_at;
}

export function getDeviceLimit(isPremium: boolean, isOwner = false): number {
  return isOwner ? 999 : isPremium ? 5 : 1;
}
