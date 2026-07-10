// Catálogo de cosméticos premium.
// Cada item define: slug, nombre, requisito (nivel o plan).

import bannerHiganbana from "@/assets/banner-higanbana.jpg";
import bannerLotus from "@/assets/banner-lotus.jpg";
import bannerRoses from "@/assets/banner-roses.jpg";

export type CosmeticRequirement =
  | { type: "free" }
  | { type: "level"; value: number }
  | { type: "premium" };

export interface AvatarFrameDef {
  slug: string;
  name: string;
  className: string;
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
  cursor: string;
  requirement: CosmeticRequirement;
}

export interface BannerPresetDef {
  slug: string;
  name: string;
  gradient: string; // css background completa (gradient o url())
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

// Cursores SVG inline. hotspot indicado tras la url() (px x y).
export const CURSOR_THEMES: CursorThemeDef[] = [
  { slug: "default", name: "Sistema",  cursor: "auto", requirement: { type: "free" } },
  {
    slug: "katana",
    name: "Katana",
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><line x1="4" y1="28" x2="26" y2="6" stroke="%23ff4500" stroke-width="3" stroke-linecap="round"/><line x1="4" y1="28" x2="26" y2="6" stroke="%23fff" stroke-width="1" stroke-linecap="round"/><rect x="2" y="26" width="6" height="4" fill="%23222" transform="rotate(-45 5 28)"/></g></svg>') 4 28, auto`,
    requirement: { type: "premium" },
  },
  {
    slug: "kunai",
    name: "Kunai",
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="%23888" stroke="%23000" stroke-width="0.5"><polygon points="16,2 20,14 16,26 12,14"/><rect x="14" y="20" width="4" height="8" fill="%23444"/></g></svg>') 16 2, auto`,
    requirement: { type: "level", value: 5 },
  },
  {
    slug: "daga",
    name: "Daga",
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><polygon points="16,2 18,20 16,24 14,20" fill="%23cfd8dc" stroke="%23000" stroke-width="0.8"/><rect x="12" y="22" width="8" height="3" fill="%238b5a2b"/><rect x="14" y="24" width="4" height="6" fill="%235a3c1e"/><circle cx="16" cy="30" r="1.5" fill="%23ffd700"/></g></svg>') 16 2, auto`,
    requirement: { type: "level", value: 10 },
  },
  {
    slug: "flecha",
    name: "Flecha",
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><line x1="4" y1="28" x2="24" y2="8" stroke="%238b5a2b" stroke-width="2"/><polygon points="28,4 22,6 24,10 20,12" fill="%23cfd8dc" stroke="%23000" stroke-width="0.6"/><polygon points="2,30 6,26 4,24 8,22 6,20 2,26" fill="%23e53935"/></g></svg>') 28 4, auto`,
    requirement: { type: "level", value: 15 },
  },
  {
    slug: "espada-grande",
    name: "Espada grande",
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><polygon points="16,1 20,22 16,26 12,22" fill="%23e0e0e0" stroke="%23000" stroke-width="0.8"/><line x1="16" y1="4" x2="16" y2="22" stroke="%23888" stroke-width="0.6"/><rect x="8" y="22" width="16" height="3" fill="%235d4037"/><rect x="14" y="25" width="4" height="7" fill="%234e342e"/></g></svg>') 16 1, auto`,
    requirement: { type: "premium" },
  },
  {
    slug: "dragon",
    name: "Dragón",
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><path d="M4 24 Q10 18 16 20 Q22 22 28 16 L26 20 Q22 26 16 24 Q10 22 4 28 Z" fill="%23c62828" stroke="%23000" stroke-width="0.8"/><circle cx="26" cy="18" r="1.2" fill="%23ffeb3b"/><path d="M28 16 L30 12 L28 14 Z" fill="%23ff6f00"/></g></svg>') 16 20, auto`,
    requirement: { type: "premium" },
  },
  {
    slug: "hacha",
    name: "Hacha",
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><rect x="14" y="6" width="2" height="24" fill="%235d4037"/><path d="M6 4 Q16 2 22 8 L22 14 Q16 10 6 12 Z" fill="%23bdbdbd" stroke="%23000" stroke-width="0.8"/></g></svg>') 15 6, auto`,
    requirement: { type: "level", value: 20 },
  },
  {
    slug: "star",
    name: "Estrella",
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><polygon points="16,2 20,12 30,12 22,18 26,28 16,22 6,28 10,18 2,12 12,12" fill="%23ffcc00" stroke="%23000" stroke-width="1"/></svg>') 16 16, auto`,
    requirement: { type: "level", value: 25 },
  },
];

// Banners nativos (gradientes + imágenes IA). Los banners del admin llegan por hook aparte.
export const BANNER_PRESETS: BannerPresetDef[] = [
  { slug: "aurora",     name: "Aurora",         gradient: "linear-gradient(135deg,#0f1a3d 0%,#2b1055 40%,#7597de 80%,#ff6b9d 100%)", requirement: { type: "free" } },
  { slug: "sakura-g",   name: "Sakura",         gradient: "linear-gradient(135deg,#0d0221 0%,#4a1942 45%,#e75480 100%)",                requirement: { type: "level", value: 5 } },
  { slug: "cyber",      name: "Cyber city",     gradient: "linear-gradient(135deg,#000428 0%,#004e92 50%,#ff005c 100%)",                requirement: { type: "level", value: 10 } },
  { slug: "sunset",     name: "Atardecer",      gradient: "linear-gradient(135deg,#2b0a3d 0%,#ff5f6d 60%,#ffc371 100%)",                requirement: { type: "premium" } },
  { slug: "ocean",      name: "Océano",         gradient: "linear-gradient(135deg,#001f3f 0%,#0074d9 50%,#7fdbff 100%)",                requirement: { type: "premium" } },
  { slug: "forest",     name: "Bosque místico", gradient: "linear-gradient(135deg,#0b3d0b 0%,#245c2f 50%,#a6ff96 100%)",                requirement: { type: "premium" } },
  { slug: "noir",       name: "Noir",           gradient: "linear-gradient(135deg,#0a0a0a 0%,#2b2b2b 50%,#e5e5e5 100%)",                requirement: { type: "premium" } },
  { slug: "gold",       name: "Dorado",         gradient: "linear-gradient(135deg,#1a1200 0%,#5c3d00 40%,#f5c542 80%,#fff2b3 100%)",   requirement: { type: "premium" } },
  // Ilustraciones IA
  { slug: "higanbana",  name: "Higanbana (muerte)", gradient: `url("${bannerHiganbana}") center/cover no-repeat`, requirement: { type: "level", value: 12 } },
  { slug: "lotus",      name: "Loto",            gradient: `url("${bannerLotus}") center/cover no-repeat`,       requirement: { type: "level", value: 6 } },
  { slug: "roses",      name: "Rosas de sangre", gradient: `url("${bannerRoses}") center/cover no-repeat`,       requirement: { type: "premium" } },
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

/** Requisito serializado desde admin_banners a nuestro tipo. */
export function reqFromAdmin(type: string, value: number): CosmeticRequirement {
  if (type === "premium") return { type: "premium" };
  if (type === "level") return { type: "level", value: Math.max(0, value | 0) };
  return { type: "free" };
}
