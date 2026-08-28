import { useCallback, useEffect, useState } from "react";

export type SubFont = "sans" | "serif" | "cursive" | "hand" | "gothic" | "bold";

export interface SubtitlePrefs {
  size: number;          // 60-200 (%)
  color: string;         // hex
  bg: "none" | "black" | "semi";
  font: SubFont;
  position: "low" | "mid" | "high";
  weight: "normal" | "bold";
}

export const DEFAULT_SUB_PREFS: SubtitlePrefs = {
  size: 100,
  color: "#ffffff",
  bg: "none",
  font: "sans",
  position: "low",
  weight: "bold",
};

const KEY = "zet:sub-prefs:v1";

// Fuente de verdad de lo que es gratis. Debe coincidir con SubtitleSettings.
export const FREE_SUB_COLORS = ["#ffffff", "#ffe600"];
export const FREE_SUB_FONTS: SubFont[] = ["serif", "cursive"];

// Valores por defecto para cuentas gratis / invitados (nada premium preseleccionado).
export const FREE_SUB_PREFS: SubtitlePrefs = {
  ...DEFAULT_SUB_PREFS,
  size: 100,
  color: "#ffffff",
  bg: "none",
  font: "serif",
};

/** Fuerza que un usuario no premium nunca tenga opciones de pago activas. */
export function sanitizeSubPrefs(prefs: SubtitlePrefs, isPremium: boolean): SubtitlePrefs {
  if (isPremium) return prefs;
  return {
    ...prefs,
    size: FREE_SUB_PREFS.size,
    bg: FREE_SUB_PREFS.bg,
    color: FREE_SUB_COLORS.includes((prefs.color || "").toLowerCase()) ? prefs.color : FREE_SUB_PREFS.color,
    font: FREE_SUB_FONTS.includes(prefs.font) ? prefs.font : FREE_SUB_PREFS.font,
  };
}

export function useSubtitlePrefs(isPremium = false) {
  const [prefs, setPrefs] = useState<SubtitlePrefs>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return sanitizeSubPrefs({ ...DEFAULT_SUB_PREFS, ...JSON.parse(raw) }, isPremium);
    } catch { /* noop */ }
    return isPremium ? DEFAULT_SUB_PREFS : FREE_SUB_PREFS;
  });

  // Si el plan cambia (logout, expiración), se revierten las opciones de pago.
  useEffect(() => {
    setPrefs((p) => {
      const clean = sanitizeSubPrefs(p, isPremium);
      return JSON.stringify(clean) === JSON.stringify(p) ? p : clean;
    });
  }, [isPremium]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* noop */ }
  }, [prefs]);

  const update = useCallback((patch: Partial<SubtitlePrefs>) => {
    setPrefs((p) => sanitizeSubPrefs({ ...p, ...patch }, isPremium));
  }, [isPremium]);

  const reset = useCallback(
    () => setPrefs(isPremium ? DEFAULT_SUB_PREFS : FREE_SUB_PREFS),
    [isPremium]
  );

  return { prefs, update, reset };
}

export function subtitleStyle(prefs: SubtitlePrefs): React.CSSProperties {
  const fontFamily =
    prefs.font === "serif"   ? "'EB Garamond', 'Georgia', serif" :
    prefs.font === "cursive" ? "'Dancing Script', cursive" :
    prefs.font === "hand"    ? "'Caveat', cursive" :
    prefs.font === "gothic"  ? "'MedievalSharp', 'Cinzel', serif" :
    prefs.font === "bold"    ? "'Anton', 'Impact', sans-serif" :
    "'Inter', system-ui, sans-serif";

  const baseSize = 22 * (prefs.size / 100);
  const bg =
    prefs.bg === "black" ? "rgba(0,0,0,0.85)" :
    prefs.bg === "semi"  ? "rgba(0,0,0,0.45)" :
    "transparent";

  // Cuando el texto es negro, añadimos borde blanco para que sea legible.
  const isBlackText = prefs.color.toLowerCase() === "#000000";
  const shadow = isBlackText
    ? "1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 0 0 4px #fff"
    : prefs.bg === "none"
      ? "2px 2px 4px #000, 0 0 10px #000, -1px -1px 2px #000"
      : "none";

  return {
    color: prefs.color,
    fontFamily,
    fontWeight: prefs.weight === "bold" ? 700 : 400,
    fontSize: `clamp(${baseSize * 0.7}px, ${prefs.size * 0.024}vw, ${baseSize * 1.3}px)`,
    background: bg,
    padding: prefs.bg === "none" ? "4px 12px" : "6px 14px",
    borderRadius: prefs.bg === "none" ? 0 : 6,
    textShadow: shadow,
    lineHeight: 1.25,
  };
}

export function subtitlePositionClass(pos: SubtitlePrefs["position"], isFullscreen: boolean) {
  if (pos === "high") return isFullscreen ? "top-[10%]" : "top-[12%]";
  if (pos === "mid")  return "top-1/2 -translate-y-1/2";
  return isFullscreen ? "bottom-[16%]" : "bottom-[18%]";
}
