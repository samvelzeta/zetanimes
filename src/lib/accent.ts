// Accent color system - stores in localStorage and applies CSS variables

export interface AccentColor {
  name: string;
  hex: string;
  hsl: string; // raw HSL values for CSS var
  premium?: boolean;
}

export const ACCENT_COLORS: AccentColor[] = [
  // Free colors
  { name: "Naranja", hex: "#FF4500", hsl: "16 100% 50%" },
  { name: "Púrpura", hex: "#9333EA", hsl: "270 79% 56%" },
  { name: "Verde", hex: "#22C55E", hsl: "142 71% 45%" },
  { name: "Azul", hex: "#3B82F6", hsl: "217 91% 60%" },
  { name: "Rosa", hex: "#EC4899", hsl: "330 81% 60%" },
  // Premium-exclusive palette
  { name: "Oro", hex: "#EAB308", hsl: "45 93% 47%", premium: true },
  { name: "Carmesí", hex: "#DC143C", hsl: "348 83% 47%", premium: true },
  { name: "Cian Neón", hex: "#06B6D4", hsl: "189 94% 43%", premium: true },
  { name: "Esmeralda", hex: "#10B981", hsl: "160 84% 39%", premium: true },
  { name: "Violeta Galaxia", hex: "#7C3AED", hsl: "262 83% 58%", premium: true },
  { name: "Coral", hex: "#FB7185", hsl: "351 95% 71%", premium: true },
  { name: "Lima Eléctrico", hex: "#84CC16", hsl: "84 81% 44%", premium: true },
  { name: "Plata Metálico", hex: "#94A3B8", hsl: "215 20% 65%", premium: true },
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

// Call on app init - if user picked a premium color but lost premium, fallback to default
export function initAccentColor(isPremium = true) {
  const color = getAccentColor();
  if (color.premium && !isPremium) {
    applyAccentColor(ACCENT_COLORS[0]);
  } else {
    applyAccentColor(color);
  }
}
