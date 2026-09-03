import { supabase } from "@/integrations/supabase/client";
import { idbGet, idbSet, idbDelete } from "@/lib/idb-cache";

/**
 * Manifiesto único de visibilidad.
 * Sustituye 5-6 consultas por página (aprobados, ocultos, adultos, seeke, reserva, estados)
 * por una sola llamada cacheada: memoria → IndexedDB → edge (KV) → base de datos.
 */

export interface VisibilityManifest {
  approved: number[];
  hidden: number[];
  adult: number[];
  seeke: number[];
  reserve: number[];
  dubbed: number[];
  status_overrides: Record<string, string>;
}

export interface VisibilitySets {
  approved: Set<number>;
  hidden: Set<number>;
  adult: Set<number>;
  seeke: Set<number>;
  reserve: Set<number>;
  dubbed: Set<number>;
  statusOverrides: Map<number, string>;
}

const IDB_KEY = "visibility_manifest_v1";
const IDB_TTL = 60 * 60 * 1000; // 1 h — se purga al invalidar tras cualquier CRUD

let mem: VisibilitySets | null = null;
let inflight: Promise<VisibilitySets> | null = null;

const EMPTY: VisibilityManifest = {
  approved: [], hidden: [], adult: [], seeke: [], reserve: [], dubbed: [], status_overrides: {},
};

function toSets(m: VisibilityManifest): VisibilitySets {
  const nums = (arr: unknown): Set<number> =>
    new Set(((arr as number[]) || []).map(Number).filter(Number.isFinite));
  const overrides = new Map<number, string>();
  for (const [k, v] of Object.entries(m.status_overrides || {})) {
    const id = Number(k);
    if (Number.isFinite(id) && typeof v === "string") overrides.set(id, v);
  }
  return {
    approved: nums(m.approved),
    hidden: nums(m.hidden),
    adult: nums(m.adult),
    seeke: nums(m.seeke),
    reserve: nums(m.reserve),
    dubbed: nums(m.dubbed),
    statusOverrides: overrides,
  };
}

async function fetchManifest(): Promise<VisibilityManifest> {
  // 1) Edge function con caché KV compartido entre todos los usuarios
  try {
    const { data, error } = await supabase.functions.invoke("visibility-manifest", {
      body: { action: "get" },
    });
    if (!error && data?.manifest) return data.manifest as VisibilityManifest;
  } catch {
    /* fallback abajo */
  }
  // 2) Fallback directo al RPC (una sola consulta)
  try {
    const { data, error } = await (supabase as any).rpc("get_visibility_manifest");
    if (!error && data) return data as VisibilityManifest;
  } catch {
    /* noop */
  }
  return EMPTY;
}

export async function getVisibility(force = false): Promise<VisibilitySets> {
  if (!force && mem) return mem;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    if (!force) {
      const cached = await idbGet<VisibilityManifest>(IDB_KEY);
      if (cached) {
        mem = toSets(cached);
        return mem;
      }
    }
    const manifest = await fetchManifest();
    mem = toSets(manifest);
    idbSet(IDB_KEY, manifest, IDB_TTL).catch(() => {});
    return mem;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Limpia el manifiesto local y (opcionalmente) el KV compartido tras un CRUD de admin. */
export async function invalidateVisibility(remote = true) {
  mem = null;
  inflight = null;
  await idbDelete(IDB_KEY).catch(() => {});
  if (remote) {
    try {
      await supabase.functions.invoke("visibility-manifest", { body: { action: "invalidate" } });
    } catch {
      /* noop */
    }
  }
}

export function peekVisibility(): VisibilitySets | null {
  return mem;
}
