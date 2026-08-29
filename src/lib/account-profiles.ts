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
  created_at: string;
  updated_at: string;
}

/** Columnas legibles por el cliente. `pin_hash` NUNCA se expone al navegador. */
export const PROFILE_COLUMNS =
  "id, user_id, name, avatar_url, accent_color, font_family, is_default, pin_enabled, created_at, updated_at";


export const MAX_PROFILES_FREE = 2;
export const MAX_PROFILES_PREMIUM = 3;
/** @deprecated usar getMaxProfiles(isPremium) */
export const MAX_PROFILES = MAX_PROFILES_PREMIUM;

export function getMaxProfiles(isPremium: boolean, planLimit?: number): number {
  if (typeof planLimit === "number" && planLimit > 0) return planLimit;
  return isPremium ? MAX_PROFILES_PREMIUM : MAX_PROFILES_FREE;
}

export function getMainProfile(profiles: AccountProfile[]): AccountProfile | null {
  return profiles.find((profile) => profile.is_default) || profiles[0] || null;
}

const ACTIVE_KEY = "zet:active-profile-id";
const PIN_OK_PREFIX = "zet:pin-ok:";
let activeProfileId: string | null = null;

function readSessionActiveProfile(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_KEY);
  } catch {
    return activeProfileId;
  }
}

export function getActiveProfileId(): string | null {
  activeProfileId = readSessionActiveProfile();
  return activeProfileId;
}

export function setActiveProfileId(id: string | null): void {
  const previous = activeProfileId;
  activeProfileId = id;
  try {
    localStorage.removeItem(ACTIVE_KEY);
    if (id) sessionStorage.setItem(ACTIVE_KEY, id);
    else sessionStorage.removeItem(ACTIVE_KEY);
    // Cada vez que cambia el perfil activo invalidamos los PIN de TODOS
    // los demás perfiles, para que al volver a uno protegido SIEMPRE
    // se vuelva a pedir el PIN. Conservamos el flag del perfil que se
    // acaba de seleccionar (lo seteó markProfilePin justo antes).
    if (previous !== id) {
      const keep = id ? PIN_OK_PREFIX + id : null;
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(PIN_OK_PREFIX) && k !== keep)
        .forEach((k) => sessionStorage.removeItem(k));
    }
  } catch {}
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
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return (data as AccountProfile[]) || [];
}

export async function ensureMainProfile(
  userId: string,
  payload: { name: string; avatar_url?: string | null },
): Promise<AccountProfile | null> {
  const existing = await listProfiles(userId);
  const main = getMainProfile(existing);
  if (main) {
    if (!main.is_default) {
      await supabase.from("account_profiles").update({ is_default: true }).eq("id", main.id);
      main.is_default = true;
    }
    return main;
  }
  return createProfile(userId, {
    name: payload.name,
    avatar_url: payload.avatar_url ?? null,
    accent_color: null,
    is_default: true,
    pin: null,
  });
}

export async function createProfile(
  userId: string,
  payload: {
    name: string;
    avatar_url?: string | null;
    accent_color?: string | null;
    is_default?: boolean;
    pin?: string | null;
  },
): Promise<AccountProfile | null> {
  const insertPayload: any = {
    user_id: userId,
    name: payload.name,
    avatar_url: payload.avatar_url ?? null,
    accent_color: payload.accent_color ?? null,
    is_default: payload.is_default ?? false,
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
