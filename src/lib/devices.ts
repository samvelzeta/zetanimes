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
}

/**
 * Registra/actualiza el dispositivo actual.
 * Devuelve { allowed: true } si entra, { allowed: false, limit, current } si supera el cupo.
 */
export async function registerCurrentDevice(userId: string, isPremium: boolean): Promise<{
  allowed: boolean;
  limit: number;
  current: number;
  isCurrent?: boolean;
}> {
  const limit = isPremium ? 5 : 2;
  const info = getDeviceInfo();

  // 1) Listar sesiones activas (últimas N horas)
  const cutoff = new Date(Date.now() - INACTIVE_HOURS * 60 * 60 * 1000).toISOString();
  const { data: active } = await supabase
    .from("device_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("last_active_at", cutoff);

  const list = active || [];
  const exists = list.find((d) => d.device_id === info.deviceId);

  if (exists) {
    // Update timestamp
    await supabase
      .from("device_sessions")
      .update({ last_active_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("device_id", info.deviceId);
    return { allowed: true, limit, current: list.length, isCurrent: true };
  }

  if (list.length >= limit) {
    return { allowed: false, limit, current: list.length };
  }

  // 2) Insertar nuevo
  await supabase.from("device_sessions").upsert(
    {
      user_id: userId,
      device_id: info.deviceId,
      device_name: info.deviceName,
      platform: info.platform,
      user_agent: info.userAgent,
      last_active_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_id" },
  );
  return { allowed: true, limit, current: list.length + 1, isCurrent: true };
}

export async function listMyDevices(userId: string): Promise<DeviceSession[]> {
  const { data } = await supabase
    .from("device_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("last_active_at", { ascending: false });
  return (data as DeviceSession[]) || [];
}

export async function revokeDevice(userId: string, deviceId: string): Promise<void> {
  await supabase.from("device_sessions").delete().eq("user_id", userId).eq("device_id", deviceId);
}

export async function touchCurrentDevice(userId: string): Promise<void> {
  const info = getDeviceInfo();
  await supabase
    .from("device_sessions")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("device_id", info.deviceId);
}
