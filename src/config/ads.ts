/**
 * ⚙️ CONFIGURACIÓN CENTRAL DE ANUNCIOS (Adsterra + Clickadilla/VAST)
 *
 * Aquí se leen TODOS los códigos de anuncios. Hay 3 niveles de prioridad:
 *
 *  1. `public/ads.config.js`  → se edita en el hosting SIN recompilar la página.
 *                               (define `window.__ZET_ADS__ = { ... }`)
 *  2. Variables del archivo `.env` (VITE_ADS_*) → se aplican al compilar.
 *  3. Valores por defecto de abajo.
 *
 * Para cambiar un código: edita `public/ads.config.js` en tu hosting y recarga.
 */

export type AdsConfig = {
  /** Dominio del script de banners Adsterra */
  adsterraBannerHost: string;
  /** Dominio del script del banner nativo Adsterra */
  adsterraNativeHost: string;
  /** Claves de banner por tamaño */
  banners: {
    "728x90": string;
    "468x60": string;
    "300x250": string;
    "160x600": string;
    "160x300": string;
    "320x50": string;
  };
  /** Clave del banner nativo (tarjetas dentro de los carruseles) */
  nativeKey: string;
  /** Spots VAST de video (Clickadilla / Yomeno) */
  vastPool: string[];
};

const DEFAULTS: AdsConfig = {
  adsterraBannerHost: "https://www.highrevenueformat.com",
  adsterraNativeHost: "https://pl31283085.profitableratecpmnetwork.com",
  banners: {
    "728x90": "eebb19fcf28c2907bf6e9e7c31cd7790",
    "468x60": "e7c89c10abea8be0ca7ba73eb567b59b",
    "300x250": "a24e5ed09cc43dbd1d28fd3dacc6d8d9",
    "160x600": "206a77b367bee5bdf0baaa360f8813ea",
    "160x300": "618901f4115f0cd2c0fccf606542ce2c",
    "320x50": "77756600bf28ba3f4c24b79865c14ec7",
  },
  nativeKey: "a4634fe6810bcceab4700c8b656fb61d",
  // Waterfall VAST de Clickadilla: [0] = PRIMARY, [1] = FALLBACK.
  // Solo 2 spots y siempre en cascada (nunca simultáneos) para no invalidar impresiones.
  vastPool: [
    PRIMARY_VAST_URL,
    FALLBACK_VAST_URL,
  ],
};

const env = import.meta.env as Record<string, string | undefined>;

function runtime(): Partial<AdsConfig> & { banners?: Partial<AdsConfig["banners"]> } {
  if (typeof window === "undefined") return {};
  return ((window as any).__ZET_ADS__ ?? {}) as any;
}

function pick(runtimeValue: unknown, envValue: string | undefined, fallback: string): string {
  const rv = typeof runtimeValue === "string" ? runtimeValue.trim() : "";
  if (rv) return rv;
  const ev = (envValue ?? "").trim();
  if (ev) return ev;
  return fallback;
}

function pickList(runtimeValue: unknown, envValue: string | undefined, fallback: string[]): string[] {
  if (Array.isArray(runtimeValue) && runtimeValue.length) {
    return runtimeValue.map((v) => String(v).trim()).filter(Boolean);
  }
  const ev = (envValue ?? "").trim();
  if (ev) return ev.split(",").map((v) => v.trim()).filter(Boolean);
  return fallback;
}

let cached: AdsConfig | null = null;

export function getAdsConfig(): AdsConfig {
  if (cached) return cached;
  const r = runtime();
  const rb = r.banners ?? {};

  cached = {
    adsterraBannerHost: pick(r.adsterraBannerHost, env.VITE_ADS_BANNER_HOST, DEFAULTS.adsterraBannerHost).replace(/\/+$/, ""),
    adsterraNativeHost: pick(r.adsterraNativeHost, env.VITE_ADS_NATIVE_HOST, DEFAULTS.adsterraNativeHost).replace(/\/+$/, ""),
    banners: {
      "728x90": pick(rb["728x90"], env.VITE_ADS_KEY_728x90, DEFAULTS.banners["728x90"]),
      "468x60": pick(rb["468x60"], env.VITE_ADS_KEY_468x60, DEFAULTS.banners["468x60"]),
      "300x250": pick(rb["300x250"], env.VITE_ADS_KEY_300x250, DEFAULTS.banners["300x250"]),
      "160x600": pick(rb["160x600"], env.VITE_ADS_KEY_160x600, DEFAULTS.banners["160x600"]),
      "160x300": pick(rb["160x300"], env.VITE_ADS_KEY_160x300, DEFAULTS.banners["160x300"]),
      "320x50": pick(rb["320x50"], env.VITE_ADS_KEY_320x50, DEFAULTS.banners["320x50"]),
    },
    nativeKey: pick(r.nativeKey, env.VITE_ADS_NATIVE_KEY, DEFAULTS.nativeKey),
    vastPool: pickList(r.vastPool, env.VITE_ADS_VAST_POOL, DEFAULTS.vastPool),
  };
  return cached;
}

/** Atajos de uso frecuente */
export const adsBannerScript = (key: string) => `${getAdsConfig().adsterraBannerHost}/${key}/invoke.js`;
export const adsNativeScript = (key: string) => `${getAdsConfig().adsterraNativeHost}/${key}/invoke.js`;
export const adKey = (size: keyof AdsConfig["banners"]) => getAdsConfig().banners[size];
