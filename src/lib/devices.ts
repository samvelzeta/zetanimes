import { supabase } from "@/integrations/supabase/client";
import { getDeviceInfo } from "./device-id";

const INACTIVE_HOURS = 24 * 7; // 7 días → se considera dispositivo libre
const FRESH_LOGIN_KEY = "zet:fresh-login-at";
const FRESH_LOGIN_MS = 30_000;

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
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token || !crypto.subtle) return null;
    const data = new TextEncoder().encode(token);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

async function getDeviceEntitlements(userId: string, isPremium: boolean, unlimited: boolean) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = new Set(((data as any[]) || []).map((r) => r.role));
  const hasUnlimited = unlimited || roles.has("owner") || roles.has("admin");
  if (hasUnlimited) return { unlimited: true, limit: 999 };

  // Límite dinámico = max_streams del plan activo (2 free, 2 duo, 3 trio…).
  try {
    const { data: streams } = await supabase.rpc("get_user_max_streams" as any, { _user_id: userId });
    const n = typeof streams === "number" ? streams : Number(streams);
    if (!isNaN(n) && n > 0) return { unlimited: false, limit: n };
  } catch {}
  return { unlimited: false, limit: 2 };
}

function consumeFreshLogin(): boolean {
  try {
    const at = Number(sessionStorage.getItem(FRESH_LOGIN_KEY) || 0);
    if (!at || Date.now() - at > FRESH_LOGIN_MS) return false;
    sessionStorage.removeItem(FRESH_LOGIN_KEY);
    return true;
  } catch {
    return false;
  }
}

export function markFreshLogin() {
  try {
    sessionStorage.setItem(FRESH_LOGIN_KEY, String(Date.now()));
  } catch {}
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
  const entitlements = await getDeviceEntitlements(userId, isPremium, unlimited);
  const limit = entitlements.limit;
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
  const wasRevoked = !!currentRecord?.revoked_at;
  const canRestoreRevokedDevice = wasRevoked && (entitlements.unlimited || consumeFreshLogin() || list.length < limit);

  if (wasRevoked && !canRestoreRevokedDevice) {
    return { allowed: false, limit, current: list.length, isCurrent: true, revoked: true };
  }

  if (exists) {
    if (!entitlements.unlimited && list.length > limit) {
      return { allowed: false, limit, current: list.length, isCurrent: true };
    }
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

  if (!entitlements.unlimited && list.length >= limit) {
    return { allowed: false, limit, current: list.length, revoked: wasRevoked };
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
  if (data.revoked_at && consumeFreshLogin()) {
    await touchCurrentDevice(userId);
    return true;
  }
  // No expulsar automáticamente por una marca vieja de revoked_at: el gate de dispositivos
  // vuelve a registrar si hay cupo, y si no hay cupo muestra el modal para gestionar.
  return true;
}

export function getDeviceLimit(isPremium: boolean, isOwner = false, planLimit?: number): number {
  if (isOwner) return 999;
  if (typeof planLimit === "number" && planLimit > 0) return planLimit;
  return isPremium ? 1 : 1;
}
