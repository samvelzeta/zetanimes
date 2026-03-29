// Accent color system - stores in localStorage and applies CSS variables

export interface AccentColor {
  name: string;
  hex: string;
  hsl: string; // raw HSL values for CSS var
}

export const ACCENT_COLORS: AccentColor[] = [
  { name: "Naranja", hex: "#FF4500", hsl: "16 100% 50%" },
  { name: "Púrpura", hex: "#9333EA", hsl: "270 79% 56%" },
  { name: "Verde", hex: "#22C55E", hsl: "142 71% 45%" },
  { name: "Azul", hex: "#3B82F6", hsl: "217 91% 60%" },
  { name: "Rosa", hex: "#EC4899", hsl: "330 81% 60%" },
];

const STORAGE_KEY = "zet_accent_color";

export function getAccentColor(): AccentColor {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const found = ACCENT_COLORS.find((c) => c.name === parsed.name);
      if (found) return found;
    }
  } catch {}
  return ACCENT_COLORS[0]; // default orange
}

export function setAccentColor(color: AccentColor) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(color));
  applyAccentColor(color);
}

export function applyAccentColor(color: AccentColor) {
  const root = document.documentElement;
  root.style.setProperty("--primary", color.hsl);
  root.style.setProperty("--ring", color.hsl);
  root.style.setProperty("--sidebar-primary", color.hsl);
  root.style.setProperty("--sidebar-ring", color.hsl);
  root.style.setProperty("--zet-accent", color.hex);
}

// Call on app init
export function initAccentColor() {
  const color = getAccentColor();
  applyAccentColor(color);
}
