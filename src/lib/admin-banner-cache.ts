import { idbGet, idbSet } from "@/lib/idb-cache";
import { loadCosmeticsManifest, invalidateCosmeticsManifest } from "@/lib/cosmetics-manifest";

export interface AdminBannerRow {
  id: string;
  name: string;
  image_url: string;
  requirement_type: "free" | "level" | "premium" | "gacha";
  requirement_value: number;
  rarity: string;
  position: number;
}

const IDB_KEY = "admin-banners:v1";
const TTL = 24 * 60 * 60 * 1000; // 24h — las imágenes en R2 son immutable

/** Cache en memoria (id → row) compartido por toda la app. */
let memo: Map<string, AdminBannerRow> | null = null;
let inflight: Promise<Map<string, AdminBannerRow>> | null = null;

function toMap(rows: AdminBannerRow[]) {
  return new Map(rows.map((r) => [r.id, r]));
}

async function fetchFromDB(): Promise<AdminBannerRow[]> {
  // Lectura vía manifiesto cacheado permanentemente en Cloudflare KV.
  const manifest = await loadCosmeticsManifest();
  return (manifest.banners as unknown as AdminBannerRow[]) ?? [];
}

/**
 * Devuelve todos los banners activos del admin.
 * - 1 sola petición por sesión (memoria) y 1 por día (IndexedDB).
 * - Todas las llamadas concurrentes comparten la misma promesa.
 *
 * Nota de seguridad: esto es solo el CATÁLOGO público (nombre, imagen, requisito).
 * La posesión/equipado se valida siempre en el backend vía `equip_cosmetics`.
 */
export async function loadAdminBanners(): Promise<AdminBannerRow[]> {
  if (memo) return [...memo.values()].sort((a, b) => a.position - b.position);
  if (inflight) return [...(await inflight).values()].sort((a, b) => a.position - b.position);

  inflight = (async () => {
    const cached = await idbGet<AdminBannerRow[]>(IDB_KEY);
    if (cached?.length) {
      memo = toMap(cached);
      // Revalidación en segundo plano (stale-while-revalidate)
      fetchFromDB()
        .then((fresh) => {
          if (!fresh.length) return;
          memo = toMap(fresh);
          idbSet(IDB_KEY, fresh, TTL);
          warmImages(fresh);
        })
        .catch(() => {});
      return memo;
    }
    try {
      const fresh = await fetchFromDB();
      memo = toMap(fresh);
      idbSet(IDB_KEY, fresh, TTL);
      warmImages(fresh);
      return memo;
    } catch {
      memo = new Map();
      return memo;
    } finally {
      inflight = null;
    }
  })();

  const map = await inflight;
  return [...map.values()].sort((a, b) => a.position - b.position);
}

/** Lectura síncrona: si ya está en memoria evita el parpadeo del banner. */
export function getAdminBannerSync(id: string): AdminBannerRow | null {
  return memo?.get(id) ?? null;
}

/** Resuelve un banner por id (`admin:<id>` ya recortado). */
export async function getAdminBanner(id: string): Promise<AdminBannerRow | null> {
  const hit = getAdminBannerSync(id);
  if (hit) return hit;
  await loadAdminBanners();
  return memo?.get(id) ?? null;
}

/** Precarga las imágenes en el caché HTTP del navegador (R2 immutable 1 año). */
export function warmImages(rows: AdminBannerRow[]) {
  if (typeof window === "undefined") return;
  rows.forEach((r) => {
    if (!r.image_url) return;
    const img = new Image();
    img.decoding = "async";
    (img as any).fetchPriority = "low";
    img.src = r.image_url;
  });
}

/** Invalida el caché (usar tras cambios en el panel de admin). */
export async function invalidateAdminBanners() {
  memo = null;
  inflight = null;
  await idbSet(IDB_KEY, [], 0);
  await invalidateCosmeticsManifest();
}
