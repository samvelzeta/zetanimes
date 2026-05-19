// Cliente para sesiones de streaming concurrentes (separadas del login).
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device-id";

export interface StartStreamResult {
  allowed: boolean;
  session_id?: string;
  current: number;
  limit: number;
}

export async function startStream(
  profileId: string | null,
  animeId: number | null,
  episode: number | null
): Promise<StartStreamResult> {
  const { data, error } = await supabase.rpc("start_stream", {
    _device_id: getDeviceId(),
    _profile_id: profileId,
    _anime_id: animeId,
    _episode_number: episode,
  });
  if (error) {
    console.warn("[stream] start_stream error", error);
    return { allowed: true, current: 0, limit: 1 };
  }
  return data as StartStreamResult;
}

export async function heartbeatStream(sessionId: string): Promise<void> {
  await supabase.rpc("heartbeat_stream", { _session_id: sessionId });
}

export async function endStream(sessionId: string): Promise<void> {
  await supabase.rpc("end_stream", { _session_id: sessionId });
}

export async function endAllOtherStreams(keepSessionId?: string | null): Promise<void> {
  await supabase.rpc("end_all_streams_except", { _session_id: keepSessionId ?? null });
}

export async function listActiveStreams(userId: string) {
  const cutoff = new Date(Date.now() - 90 * 1000).toISOString();
  const { data } = await supabase
    .from("streaming_sessions" as any)
    .select("*")
    .eq("user_id", userId)
    .is("ended_at", null)
    .gte("last_heartbeat_at", cutoff)
    .order("started_at", { ascending: false });
  return (data as any[]) || [];
}
