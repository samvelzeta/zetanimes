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
  };
  /** Clave del banner nativo (tarjetas dentro de los carruseles) */
  nativeKey: string;
  /** Spots VAST de video (Clickadilla / Yomeno) */
  vastPool: string[];
};

const DEFAULTS: AdsConfig = {
  adsterraBannerHost: "https://www.highperformanceformat.com",
  adsterraNativeHost: "https://pl29176506.profitablecpmratenetwork.com",
  banners: {
    "728x90": "1d178d24c436e987f0076c89491f7ba5",
    "468x60": "8672e32915f1e9d41edf058deec91989",
    "300x250": "b411f21fa26a4e8427eb13433959b4e8",
    "160x600": "d4813a34656155529b56e4655b81cbdb",
    "160x300": "ab525e23c9a041206c6d3096e5581274",
  },
  nativeKey: "f22e36f62a5acf07d25a8dd129e84655",
  vastPool: [
    "https://vast.yomeno.xyz/vast?spot_id=1496604",
    "https://vast.yomeno.xyz/vast?spot_id=1496607",
    "https://vast.yomeno.xyz/vast?spot_id=1496606",
    "https://vast.yomeno.xyz/vast?spot_id=1496608",
    "https://vast.yomeno.xyz/vast?spot_id=1496609",
    "https://vast.yomeno.xyz/vast?spot_id=1496610",
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
