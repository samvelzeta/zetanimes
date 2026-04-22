import { supabase } from "@/integrations/supabase/client";

export interface AccountProfile {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  accent_color: string | null;
  font_family: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const ACTIVE_KEY = "zet:active-profile-id";
const PIN_OK_KEY = "zet:pin-session-ok";

export function getActiveProfileId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProfileId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
  window.dispatchEvent(new Event("zet:active-profile-changed"));
}

export function isPinSessionValid(): boolean {
  return sessionStorage.getItem(PIN_OK_KEY) === "1";
}

export function markPinSession(): void {
  sessionStorage.setItem(PIN_OK_KEY, "1");
}

export function clearPinSession(): void {
  sessionStorage.removeItem(PIN_OK_KEY);
}

export async function listProfiles(userId: string): Promise<AccountProfile[]> {
  const { data } = await supabase
    .from("account_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data as AccountProfile[]) || [];
}

export async function createProfile(
  userId: string,
  payload: { name: string; avatar_url?: string | null; accent_color?: string | null },
): Promise<AccountProfile | null> {
  const { data, error } = await supabase
    .from("account_profiles")
    .insert({ user_id: userId, ...payload })
    .select()
    .single();
  if (error) throw error;
  return data as AccountProfile;
}

export async function updateProfile(
  id: string,
  payload: Partial<Pick<AccountProfile, "name" | "avatar_url" | "accent_color" | "font_family">>,
): Promise<void> {
  const { error } = await supabase.from("account_profiles").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteProfile(id: string): Promise<void> {
  const { error } = await supabase.from("account_profiles").delete().eq("id", id);
  if (error) throw error;
}
