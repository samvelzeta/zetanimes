import { useCallback, useEffect, useState } from "react";

export interface SubtitlePrefs {
  size: number;          // 60-200 (%)
  color: string;         // hex
  bg: "none" | "black" | "semi";
  font: "sans" | "serif" | "mono" | "anime";
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

export function useSubtitlePrefs() {
  const [prefs, setPrefs] = useState<SubtitlePrefs>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...DEFAULT_SUB_PREFS, ...JSON.parse(raw) };
    } catch { /* noop */ }
    return DEFAULT_SUB_PREFS;
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* noop */ }
  }, [prefs]);

  const update = useCallback((patch: Partial<SubtitlePrefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
  }, []);

  const reset = useCallback(() => setPrefs(DEFAULT_SUB_PREFS), []);

  return { prefs, update, reset };
}

export function subtitleStyle(prefs: SubtitlePrefs): React.CSSProperties {
  const fontFamily =
    prefs.font === "serif" ? "'Georgia', 'Times New Roman', serif" :
    prefs.font === "mono"  ? "'JetBrains Mono', ui-monospace, monospace" :
    prefs.font === "anime" ? "'Zen Maru Gothic', 'M PLUS Rounded 1c', sans-serif" :
    "'Inter', system-ui, sans-serif";

  const baseSize = 22 * (prefs.size / 100);
  const bg =
    prefs.bg === "black" ? "rgba(0,0,0,0.85)" :
    prefs.bg === "semi"  ? "rgba(0,0,0,0.45)" :
    "transparent";
  const shadow =
    prefs.bg === "none"
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
