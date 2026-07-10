// Catálogo de cosméticos premium.
// Cada item define: slug, nombre, requisito (nivel o plan).

export type CosmeticRequirement =
  | { type: "free" }
  | { type: "level"; value: number }
  | { type: "premium" };

export interface AvatarFrameDef {
  slug: string;
  name: string;
  className: string; // clase CSS que pinta el marco
  requirement: CosmeticRequirement;
}

export interface NameEffectDef {
  slug: string;
  name: string;
  className: string;
  requirement: CosmeticRequirement;
}

export interface CursorThemeDef {
  slug: string;
  name: string;
  cursor: string; // valor css cursor:
  requirement: CosmeticRequirement;
}

export interface BannerPresetDef {
  slug: string;
  name: string;
  gradient: string; // css background
  requirement: CosmeticRequirement;
}

export const AVATAR_FRAMES: AvatarFrameDef[] = [
  { slug: "default",     name: "Sin marco",   className: "zf-frame-default",   requirement: { type: "free" } },
  { slug: "neon-orange", name: "Neón Zet",    className: "zf-frame-neon",      requirement: { type: "level", value: 3 } },
  { slug: "fire",        name: "Llamas",      className: "zf-frame-fire",      requirement: { type: "level", value: 8 } },
  { slug: "sakura",      name: "Sakura",      className: "zf-frame-sakura",    requirement: { type: "level", value: 15 } },
  { slug: "glitch",      name: "Glitch RGB",  className: "zf-frame-glitch",    requirement: { type: "premium" } },
  { slug: "gold",        name: "Dorado",      className: "zf-frame-gold",      requirement: { type: "premium" } },
  { slug: "rainbow",     name: "Arcoíris",    className: "zf-frame-rainbow",   requirement: { type: "level", value: 30 } },
];

export const NAME_EFFECTS: NameEffectDef[] = [
  { slug: "default",  name: "Normal",   className: "",                requirement: { type: "free" } },
  { slug: "shiny",    name: "Brillante",className: "zf-name-shiny",   requirement: { type: "level", value: 5 } },
  { slug: "gradient", name: "Gradiente",className: "zf-name-gradient",requirement: { type: "level", value: 10 } },
  { slug: "fire",     name: "Fuego",    className: "zf-name-fire",    requirement: { type: "premium" } },
  { slug: "ice",      name: "Hielo",    className: "zf-name-ice",     requirement: { type: "premium" } },
  { slug: "rainbow",  name: "Arcoíris", className: "zf-name-rainbow", requirement: { type: "level", value: 25 } },
];

export const CURSOR_THEMES: CursorThemeDef[] = [
  { slug: "default", name: "Sistema",  cursor: "auto",                                                   requirement: { type: "free" } },
  {
    slug: "katana",
    name: "Katana",
    // Katana SVG en línea → data URL
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><line x1="4" y1="28" x2="26" y2="6" stroke="%23ff4500" stroke-width="3" stroke-linecap="round"/><line x1="4" y1="28" x2="26" y2="6" stroke="%23fff" stroke-width="1" stroke-linecap="round"/><rect x="2" y="26" width="6" height="4" fill="%23222" transform="rotate(-45 5 28)"/></g></svg>') 4 28, auto`,
    requirement: { type: "premium" },
  },
  {
    slug: "kunai",
    name: "Kunai",
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="%23888" stroke="%23000" stroke-width="0.5"><polygon points="16,2 20,14 16,26 12,14"/><rect x="14" y="20" width="4" height="8" fill="%23444"/></g></svg>') 16 2, auto`,
    requirement: { type: "premium" },
  },
  {
    slug: "star",
    name: "Estrella",
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><polygon points="16,2 20,12 30,12 22,18 26,28 16,22 6,28 10,18 2,12 12,12" fill="%23ffcc00" stroke="%23000" stroke-width="1"/></svg>') 16 16, auto`,
    requirement: { type: "level", value: 20 },
  },
];

export const BANNER_PRESETS: BannerPresetDef[] = [
  { slug: "aurora",   name: "Aurora",         gradient: "linear-gradient(135deg,#0f1a3d 0%,#2b1055 40%,#7597de 80%,#ff6b9d 100%)", requirement: { type: "free" } },
  { slug: "sakura",   name: "Sakura",         gradient: "linear-gradient(135deg,#0d0221 0%,#4a1942 45%,#e75480 100%)",                requirement: { type: "level", value: 5 } },
  { slug: "cyber",    name: "Cyber city",     gradient: "linear-gradient(135deg,#000428 0%,#004e92 50%,#ff005c 100%)",                requirement: { type: "level", value: 10 } },
  { slug: "sunset",   name: "Atardecer",      gradient: "linear-gradient(135deg,#2b0a3d 0%,#ff5f6d 60%,#ffc371 100%)",                requirement: { type: "premium" } },
  { slug: "ocean",    name: "Océano",         gradient: "linear-gradient(135deg,#001f3f 0%,#0074d9 50%,#7fdbff 100%)",                requirement: { type: "premium" } },
  { slug: "forest",   name: "Bosque místico", gradient: "linear-gradient(135deg,#0b3d0b 0%,#245c2f 50%,#a6ff96 100%)",                requirement: { type: "premium" } },
  { slug: "noir",     name: "Noir",           gradient: "linear-gradient(135deg,#0a0a0a 0%,#2b2b2b 50%,#e5e5e5 100%)",                requirement: { type: "premium" } },
  { slug: "gold",     name: "Dorado",         gradient: "linear-gradient(135deg,#1a1200 0%,#5c3d00 40%,#f5c542 80%,#fff2b3 100%)",   requirement: { type: "premium" } },
];

export function isCosmeticUnlocked(
  req: CosmeticRequirement,
  ctx: { level: number; isPremium: boolean }
): boolean {
  if (req.type === "free") return true;
  if (req.type === "premium") return ctx.isPremium;
  if (req.type === "level") return ctx.level >= req.value;
  return false;
}

export function findFrame(slug: string | null | undefined): AvatarFrameDef {
  return AVATAR_FRAMES.find((f) => f.slug === slug) ?? AVATAR_FRAMES[0];
}
export function findEffect(slug: string | null | undefined): NameEffectDef {
  return NAME_EFFECTS.find((e) => e.slug === slug) ?? NAME_EFFECTS[0];
}
export function findCursor(slug: string | null | undefined): CursorThemeDef {
  return CURSOR_THEMES.find((c) => c.slug === slug) ?? CURSOR_THEMES[0];
}
export function findBanner(slug: string | null | undefined): BannerPresetDef {
  return BANNER_PRESETS.find((b) => b.slug === slug) ?? BANNER_PRESETS[0];
}
