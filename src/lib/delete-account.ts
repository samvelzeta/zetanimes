import { supabase } from "@/integrations/supabase/client";

/** Borra todo el almacenamiento local del navegador (IndexedDB, storage, caches, SW). */
export async function purgeLocalData() {
  try {
    localStorage.clear();
  } catch { /* noop */ }
  try {
    sessionStorage.clear();
  } catch { /* noop */ }

  // IndexedDB
  try {
    const anyIdb = indexedDB as any;
    const dbs: { name?: string }[] = anyIdb?.databases ? await anyIdb.databases() : [];
    const names = dbs.map((d) => d?.name).filter(Boolean) as string[];
    const fallback = ["zetanime-cache", "keyval-store", "localforage"];
    await Promise.all(
      Array.from(new Set([...names, ...fallback])).map(
        (n) =>
          new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase(n);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          }),
      ),
    );
  } catch { /* noop */ }

  // Cache Storage + Service Workers
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* noop */ }
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* noop */ }

  // Cookies del dominio
  try {
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (!name) return;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  } catch { /* noop */ }
}

export interface DeleteAccountResult {
  ok: boolean;
  error?: string;
}

const ERRORS: Record<string, string> = {
  name_mismatch: "El nombre no coincide con tu perfil",
  confirm_name_required: "Debes escribir el nombre de tu perfil",
  staff_cannot_self_delete: "Las cuentas de staff no pueden eliminarse desde aquí",
  unauthorized: "Sesión no válida, vuelve a iniciar sesión",
};

/** Elimina la cuenta en el backend (DB + KV + auth) y purga el navegador. */
export async function deleteAccount(confirmName: string): Promise<DeleteAccountResult> {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { confirmName },
  });

  const code = (data as any)?.error;
  if (error && !code) return { ok: false, error: "No se pudo eliminar la cuenta" };
  if (code) return { ok: false, error: ERRORS[code] ?? code };
  if (!(data as any)?.ok) return { ok: false, error: "No se pudo eliminar la cuenta" };

  await purgeLocalData();
  try {
    await supabase.auth.signOut();
  } catch { /* noop */ }
  return { ok: true };
}
