import { supabase } from "@/integrations/supabase/client";

export interface AccountProfile {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  accent_color: string | null;
  font_family: string | null;
  is_default: boolean;
  pin_enabled: boolean;
  pin_hash: string | null;
  created_at: string;
  updated_at: string;
}

export const MAX_PROFILES = 3;

const ACTIVE_KEY = "zet:active-profile-id";
const PIN_OK_PREFIX = "zet:pin-ok:";

export function getActiveProfileId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProfileId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
  window.dispatchEvent(new Event("zet:active-profile-changed"));
}

// PIN session ahora es POR PERFIL (no por cuenta)
export function isProfilePinValid(profileId: string): boolean {
  return sessionStorage.getItem(PIN_OK_PREFIX + profileId) === "1";
}

export function markProfilePin(profileId: string): void {
  sessionStorage.setItem(PIN_OK_PREFIX + profileId, "1");
}

export function clearAllProfilePins(): void {
  Object.keys(sessionStorage)
    .filter((k) => k.startsWith(PIN_OK_PREFIX))
    .forEach((k) => sessionStorage.removeItem(k));
}

// ---- Hash PIN (SHA-256 con sal por perfil) ----
export async function hashProfilePin(profileId: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`zet-profile:${profileId}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  payload: {
    name: string;
    avatar_url?: string | null;
    accent_color?: string | null;
    pin?: string | null;
  },
): Promise<AccountProfile | null> {
  const insertPayload: any = {
    user_id: userId,
    name: payload.name,
    avatar_url: payload.avatar_url ?? null,
    accent_color: payload.accent_color ?? null,
  };
  // Insert sin PIN primero para tener el id y poder saltarlo
  const { data, error } = await supabase
    .from("account_profiles")
    .insert(insertPayload)
    .select()
    .single();
  if (error) throw error;
  const created = data as AccountProfile;
  if (payload.pin && /^\d{4}$/.test(payload.pin)) {
    const hash = await hashProfilePin(created.id, payload.pin);
    await supabase
      .from("account_profiles")
      .update({ pin_hash: hash, pin_enabled: true })
      .eq("id", created.id);
    created.pin_hash = hash;
    created.pin_enabled = true;
  }
  return created;
}

export async function updateProfile(
  id: string,
  payload: Partial<Pick<AccountProfile, "name" | "avatar_url" | "accent_color" | "font_family">>,
): Promise<void> {
  const { error } = await supabase.from("account_profiles").update(payload).eq("id", id);
  if (error) throw error;
}

export async function setProfilePin(profileId: string, pin: string | null): Promise<void> {
  if (pin === null || pin === "") {
    await supabase
      .from("account_profiles")
      .update({ pin_hash: null, pin_enabled: false })
      .eq("id", profileId);
    return;
  }
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN debe ser 4 dígitos");
  const hash = await hashProfilePin(profileId, pin);
  await supabase
    .from("account_profiles")
    .update({ pin_hash: hash, pin_enabled: true })
    .eq("id", profileId);
}

export async function verifyProfilePin(profile: AccountProfile, pin: string): Promise<boolean> {
  if (!profile.pin_enabled || !profile.pin_hash) return true;
  const hash = await hashProfilePin(profile.id, pin);
  return hash === profile.pin_hash;
}

export async function deleteProfile(id: string): Promise<void> {
  const { error } = await supabase.from("account_profiles").delete().eq("id", id);
  if (error) throw error;
}
