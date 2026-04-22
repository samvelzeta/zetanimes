import { supabase } from "@/integrations/supabase/client";

// Hash SHA-256 + sal por cuenta. No es bcrypt pero es suficiente para PIN de 4 dígitos
// almacenado del lado del cliente con RLS estricta.
async function hashPin(userId: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`zet:${userId}:${pin}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface AccountSettings {
  pin_enabled: boolean;
  pin_hash: string | null;
}

export async function getAccountSettings(userId: string): Promise<AccountSettings> {
  const { data } = await supabase
    .from("account_settings")
    .select("pin_enabled, pin_hash")
    .eq("user_id", userId)
    .maybeSingle();
  return data || { pin_enabled: false, pin_hash: null };
}

export async function enablePin(userId: string, pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN debe ser de 4 dígitos");
  const hash = await hashPin(userId, pin);
  await supabase.from("account_settings").upsert(
    { user_id: userId, pin_enabled: true, pin_hash: hash, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
}

export async function disablePin(userId: string): Promise<void> {
  await supabase.from("account_settings").upsert(
    { user_id: userId, pin_enabled: false, pin_hash: null, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
}

export async function verifyPin(userId: string, pin: string): Promise<boolean> {
  const settings = await getAccountSettings(userId);
  if (!settings.pin_enabled || !settings.pin_hash) return true;
  const hash = await hashPin(userId, pin);
  return hash === settings.pin_hash;
}
