import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

/**
 * Preferencias globales del usuario (dispositivo).
 * Se sincronizan con localStorage automáticamente y aplican efectos globales
 * (clases CSS en <html>) cuando corresponde.
 */
export interface UserPreferences {
  autoPlay: boolean;
  countdown: boolean;
  dataSaver: boolean;
  hideGore: boolean;
  reducedMotion: boolean;
  keepScreenOn: boolean;
}

const DEFAULTS: UserPreferences = {
  autoPlay: true,
  countdown: false,
  dataSaver: false,
  hideGore: false,
  reducedMotion: false,
  keepScreenOn: false,
};

// Mapa key preferencia → key legacy de localStorage (compat con Settings.tsx anterior)
const LS_KEYS: Record<keyof UserPreferences, string> = {
  autoPlay: "zet_autoplay",
  countdown: "zet_countdown",
  dataSaver: "zet_datasaver",
  hideGore: "zet_hidegore",
  reducedMotion: "zet_reduced_motion",
  keepScreenOn: "zet_keep_awake",
};

function readPreference<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
  try {
    const raw = localStorage.getItem(LS_KEYS[key]);
    if (raw === null) return DEFAULTS[key];
    // autoPlay defaultea a true → cualquier valor != "false" es true
    if (key === "autoPlay") return (raw !== "false") as UserPreferences[K];
    return (raw === "true") as UserPreferences[K];
  } catch {
    return DEFAULTS[key];
  }
}

function readAll(): UserPreferences {
  return {
    autoPlay: readPreference("autoPlay"),
    countdown: readPreference("countdown"),
    dataSaver: readPreference("dataSaver"),
    hideGore: readPreference("hideGore"),
    reducedMotion: readPreference("reducedMotion"),
    keepScreenOn: readPreference("keepScreenOn"),
  };
}

interface PreferencesContextValue {
  preferences: UserPreferences;
  setPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  resetPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    typeof window === "undefined" ? DEFAULTS : readAll()
  );

  // Aplica efectos globales al montar y cada vez que cambian los flags relevantes.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("zet-reduced-motion", preferences.reducedMotion);
    root.classList.toggle("zet-data-saver", preferences.dataSaver);
  }, [preferences.reducedMotion, preferences.dataSaver]);

  const setPreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => {
        const next = { ...prev, [key]: value };
        try { localStorage.setItem(LS_KEYS[key], String(value)); } catch {}
        return next;
      });
    },
    []
  );

  const resetPreferences = useCallback(() => {
    (Object.keys(LS_KEYS) as (keyof UserPreferences)[]).forEach((k) => {
      try { localStorage.removeItem(LS_KEYS[k]); } catch {}
    });
    setPreferences(DEFAULTS);
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences, setPreference, resetPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences debe usarse dentro de <PreferencesProvider>");
  return ctx;
}

/**
 * Lectura estática (sin re-render) para código que no puede usar hooks
 * (ej: helpers, imagen transform). Sirve como fallback rápido.
 */
export function getStaticPreference<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
  if (typeof window === "undefined") return DEFAULTS[key];
  return readPreference(key);
}
