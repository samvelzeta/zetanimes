// Catálogo de cosméticos premium + sistema de rareza.

import bannerHiganbana from "@/assets/banner-higanbana.jpg";
import bannerLotus from "@/assets/banner-lotus.jpg";
import bannerRoses from "@/assets/banner-roses.jpg";
import bannerNinjas from "@/assets/banner-ninjas.jpg";
import bannerIsekai from "@/assets/banner-isekai.jpg";
import bannerSwords from "@/assets/banner-swords.jpg";
import bannerMagic from "@/assets/banner-magic.jpg";
import bannerEyes from "@/assets/banner-eyes.jpg";
import bannerZAbyss from "@/assets/banner-z-abyss.jpg";
import bannerZKing from "@/assets/banner-z-king.jpg";
import bannerZVoid from "@/assets/banner-z-void.jpg";
// Marcos 3D artísticos (PNG con hueco transparente)
import frameRoses from "@/assets/frame-roses.png";
import frameSwords from "@/assets/frame-swords.png";
import framePetals from "@/assets/frame-petals.png";
import frameThorns from "@/assets/frame-thorns.png";
import frameDragon from "@/assets/frame-dragon.png";
import frameWings from "@/assets/frame-wings.png";
import frameFlames from "@/assets/frame-flames.png";
import frameCrown from "@/assets/frame-crown.png";
import frameDemon from "@/assets/frame-demon.png";
import frameCosmic from "@/assets/frame-cosmic.png";
import frameBlood from "@/assets/frame-blood.png";
import frameLotusRed from "@/assets/frame-lotus-red.png";
import frameLotusBlue from "@/assets/frame-lotus-blue.png";
import bannerSakuraTrees from "@/assets/banner-sakura-trees.jpg";
import bannerSwampFarRed from "@/assets/banner-swamp-far-red.jpg";
import bannerSwampCloseRed from "@/assets/banner-swamp-close-red.jpg";
import bannerSwampCloseBlue from "@/assets/banner-swamp-close-blue.jpg";


export type Rarity = "basico" | "especial" | "raro" | "mitico" | "legendario" | "z";

export const RARITIES: Rarity[] = ["basico","especial","raro","mitico","legendario","z"];

export const RARITY_META: Record<Rarity, { label: string; color: string; ring: string; glow: string; chance: number }> = {
  basico:     { label: "Básico",     color: "#94a3b8", ring: "ring-slate-400/40",   glow: "0 0 6px rgba(148,163,184,0.4)",  chance: 0.45 },
  especial:   { label: "Especial",   color: "#10b981", ring: "ring-emerald-400/50", glow: "0 0 10px rgba(16,185,129,0.5)",  chance: 0.30 },
  raro:       { label: "Raro",       color: "#3b82f6", ring: "ring-blue-400/60",    glow: "0 0 14px rgba(59,130,246,0.6)",  chance: 0.15 },
  mitico:     { label: "Mítico",     color: "#a855f7", ring: "ring-purple-400/70",  glow: "0 0 18px rgba(168,85,247,0.7)",  chance: 0.07 },
  legendario: { label: "Legendario", color: "#f59e0b", ring: "ring-amber-400/80",   glow: "0 0 22px rgba(245,158,11,0.85)", chance: 0.025 },
  z:          { label: "Z",          color: "#ff005c", ring: "ring-rose-500",       glow: "0 0 26px rgba(255,0,92,0.95)",   chance: 0.005 },
};

export type CosmeticRequirement =
  | { type: "free" }
  | { type: "level"; value: number }
  | { type: "premium" }
  | { type: "gacha" };

export type FrameShape = "circle" | "hex" | "diamond" | "rounded" | "shield" | "star";

export interface AvatarFrameDef {
  slug: string;
  name: string;
  className: string;
  shape?: FrameShape;
  imageUrl?: string;
  rarity: Rarity;
  requirement: CosmeticRequirement;
}

export interface NameEffectDef {
  slug: string;
  name: string;
  className: string;
  rarity: Rarity;
  requirement: CosmeticRequirement;
}

export interface CursorThemeDef {
  slug: string;
  name: string;
  cursor: string;
  rarity: Rarity;
  requirement: CosmeticRequirement;
}

export interface BannerPresetDef {
  slug: string;
  name: string;
  gradient: string;
  rarity: Rarity;
  requirement: CosmeticRequirement;
}

// ============ MARCOS ============
export const AVATAR_FRAMES: AvatarFrameDef[] = [
  { slug: "default",     name: "Sin marco",   className: "zf-frame-default",   shape: "circle",  rarity: "basico",     requirement: { type: "free" } },
  { slug: "neon-orange", name: "Neón Zet",    className: "zf-frame-neon",      shape: "circle",  rarity: "especial",   requirement: { type: "level", value: 50 } },
  { slug: "sakura",      name: "Sakura",      className: "zf-frame-sakura",    shape: "circle",  rarity: "especial",   requirement: { type: "level", value: 50 } },
  { slug: "hex-neon",    name: "Hexágono neón",className: "zf-frame-neon",     shape: "hex",     rarity: "raro",       requirement: { type: "level", value: 70 } },
  { slug: "shield-fire", name: "Escudo llameante", className: "zf-frame-fire", shape: "shield",  rarity: "raro",       requirement: { type: "level", value: 70 } },
  { slug: "diamond-ice", name: "Diamante de hielo", className: "zf-frame-neon", shape: "diamond", rarity: "mitico",    requirement: { type: "level", value: 90 } },
  { slug: "star-gold",   name: "Estrella dorada", className: "zf-frame-gold",  shape: "star",    rarity: "mitico",     requirement: { type: "premium" } },
  { slug: "rainbow",     name: "Arcoíris",    className: "zf-frame-rainbow",   shape: "circle",  rarity: "legendario", requirement: { type: "level", value: 120 } },

  // ── Marcos artísticos 3D con overlay PNG ──
  { slug: "art-petals",  name: "Pétalos de sakura", className: "zf-frame-art", shape: "circle", imageUrl: framePetals, rarity: "especial",   requirement: { type: "level", value: 50 } },
  { slug: "art-flames",  name: "Aro de fuego azul", className: "zf-frame-art", shape: "circle", imageUrl: frameFlames, rarity: "raro",       requirement: { type: "level", value: 70 } },
  { slug: "art-thorns",  name: "Espinas malditas",  className: "zf-frame-art", shape: "circle", imageUrl: frameThorns, rarity: "raro",       requirement: { type: "level", value: 70 } },
  { slug: "art-swords",  name: "Espadas cruzadas",  className: "zf-frame-art", shape: "circle", imageUrl: frameSwords, rarity: "mitico",     requirement: { type: "level", value: 90 } },
  { slug: "art-roses",   name: "Rosas y espinas",   className: "zf-frame-art", shape: "circle", imageUrl: frameRoses,  rarity: "mitico",     requirement: { type: "premium" } },
  { slug: "art-wings",   name: "Alas celestiales",  className: "zf-frame-art", shape: "circle", imageUrl: frameWings,  rarity: "legendario", requirement: { type: "premium" } },
  { slug: "art-crown",   name: "Corona real",       className: "zf-frame-art", shape: "circle", imageUrl: frameCrown,  rarity: "legendario", requirement: { type: "gacha" } },
  { slug: "art-dragon",  name: "Dragón dorado",     className: "zf-frame-art", shape: "circle", imageUrl: frameDragon, rarity: "legendario", requirement: { type: "gacha" } },
  { slug: "art-lotus-red",  name: "Loto rojo",  className: "zf-frame-art", shape: "circle", imageUrl: frameLotusRed,  rarity: "legendario", requirement: { type: "level", value: 28 } },
  { slug: "art-lotus-blue", name: "Loto azul",  className: "zf-frame-art", shape: "circle", imageUrl: frameLotusBlue, rarity: "legendario", requirement: { type: "gacha" } },

  // ── Z: 3 marcos únicos animados, solo gacha ──
  { slug: "z-demon",     name: "Portal demoníaco",  className: "zf-frame-art zf-frame-z", shape: "circle", imageUrl: frameDemon,  rarity: "z", requirement: { type: "gacha" } },
  { slug: "z-cosmic",    name: "Fénix cósmico",     className: "zf-frame-art zf-frame-z", shape: "circle", imageUrl: frameCosmic, rarity: "z", requirement: { type: "gacha" } },
  { slug: "z-blood",     name: "Sangre eterna",     className: "zf-frame-art zf-frame-z zf-frame-blood", shape: "circle", imageUrl: frameBlood, rarity: "z", requirement: { type: "gacha" } },

];

export const NAME_EFFECTS: NameEffectDef[] = [
  { slug: "default",  name: "Normal",   className: "",                rarity: "basico",     requirement: { type: "free" } },
  { slug: "shiny",    name: "Brillante",className: "zf-name-shiny",   rarity: "especial",   requirement: { type: "level", value: 5 } },
  { slug: "neon",     name: "Neón",     className: "zf-name-neon",    rarity: "especial",   requirement: { type: "level", value: 8 } },
  { slug: "gradient", name: "Gradiente",className: "zf-name-gradient",rarity: "raro",       requirement: { type: "level", value: 10 } },
  { slug: "toxic",    name: "Tóxico",   className: "zf-name-toxic",   rarity: "raro",       requirement: { type: "level", value: 13 } },
  { slug: "gold",     name: "Dorado",   className: "zf-name-gold",    rarity: "raro",       requirement: { type: "level", value: 16 } },
  { slug: "fire",     name: "Fuego",    className: "zf-name-fire",    rarity: "mitico",     requirement: { type: "premium" } },
  { slug: "ice",      name: "Hielo",    className: "zf-name-ice",     rarity: "mitico",     requirement: { type: "premium" } },
  { slug: "blood",    name: "Sangre",   className: "zf-name-blood",   rarity: "mitico",     requirement: { type: "level", value: 20 } },
  { slug: "galaxy",   name: "Galaxia",  className: "zf-name-galaxy",  rarity: "mitico",     requirement: { type: "premium" } },
  { slug: "glitch",   name: "Glitch",   className: "zf-name-glitch",  rarity: "legendario", requirement: { type: "level", value: 27 } },
  { slug: "rainbow",  name: "Arcoíris", className: "zf-name-rainbow", rarity: "legendario", requirement: { type: "level", value: 25 } },
  { slug: "void",     name: "Vacío",    className: "zf-name-void",    rarity: "legendario", requirement: { type: "gacha" } },
  { slug: "z-name",   name: "Aura Z",   className: "zf-name-z",       rarity: "z",          requirement: { type: "gacha" } },
];

export const CURSOR_THEMES: CursorThemeDef[] = [
  { slug: "default", name: "Sistema", cursor: "auto", rarity: "basico", requirement: { type: "free" } },
  {
    slug: "katana", name: "Katana", rarity: "especial", requirement: { type: "level", value: 3 },
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><line x1="4" y1="28" x2="26" y2="6" stroke="%23ff4500" stroke-width="3" stroke-linecap="round"/><line x1="4" y1="28" x2="26" y2="6" stroke="%23fff" stroke-width="1" stroke-linecap="round"/><rect x="2" y="26" width="6" height="4" fill="%23222" transform="rotate(-45 5 28)"/></g></svg>') 4 28, auto`,
  },
  {
    slug: "kunai", name: "Kunai", rarity: "especial", requirement: { type: "level", value: 5 },
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="%23888" stroke="%23000" stroke-width="0.5"><polygon points="16,2 20,14 16,26 12,14"/><rect x="14" y="20" width="4" height="8" fill="%23444"/></g></svg>') 16 2, auto`,
  },
  {
    slug: "daga", name: "Daga", rarity: "raro", requirement: { type: "level", value: 10 },
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><polygon points="16,2 18,20 16,24 14,20" fill="%23cfd8dc" stroke="%23000" stroke-width="0.8"/><rect x="12" y="22" width="8" height="3" fill="%238b5a2b"/><rect x="14" y="24" width="4" height="6" fill="%235a3c1e"/><circle cx="16" cy="30" r="1.5" fill="%23ffd700"/></g></svg>') 16 2, auto`,
  },
  {
    slug: "flecha", name: "Flecha", rarity: "raro", requirement: { type: "level", value: 15 },
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><line x1="4" y1="28" x2="24" y2="8" stroke="%238b5a2b" stroke-width="2"/><polygon points="28,4 22,6 24,10 20,12" fill="%23cfd8dc" stroke="%23000" stroke-width="0.6"/><polygon points="2,30 6,26 4,24 8,22 6,20 2,26" fill="%23e53935"/></g></svg>') 28 4, auto`,
  },
  {
    slug: "hacha", name: "Hacha", rarity: "raro", requirement: { type: "level", value: 20 },
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><rect x="14" y="6" width="2" height="24" fill="%235d4037"/><path d="M6 4 Q16 2 22 8 L22 14 Q16 10 6 12 Z" fill="%23bdbdbd" stroke="%23000" stroke-width="0.8"/></g></svg>') 15 6, auto`,
  },
  {
    slug: "espada-grande", name: "Espada grande", rarity: "mitico", requirement: { type: "premium" },
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><polygon points="16,1 20,22 16,26 12,22" fill="%23e0e0e0" stroke="%23000" stroke-width="0.8"/><line x1="16" y1="4" x2="16" y2="22" stroke="%23888" stroke-width="0.6"/><rect x="8" y="22" width="16" height="3" fill="%235d4037"/><rect x="14" y="25" width="4" height="7" fill="%234e342e"/></g></svg>') 16 1, auto`,
  },
  {
    slug: "dragon", name: "Dragón", rarity: "legendario", requirement: { type: "premium" },
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><path d="M4 24 Q10 18 16 20 Q22 22 28 16 L26 20 Q22 26 16 24 Q10 22 4 28 Z" fill="%23c62828" stroke="%23000" stroke-width="0.8"/><circle cx="26" cy="18" r="1.2" fill="%23ffeb3b"/><path d="M28 16 L30 12 L28 14 Z" fill="%23ff6f00"/></g></svg>') 16 20, auto`,
  },
  {
    slug: "star", name: "Estrella", rarity: "legendario", requirement: { type: "level", value: 25 },
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><polygon points="16,2 20,12 30,12 22,18 26,28 16,22 6,28 10,18 2,12 12,12" fill="%23ffcc00" stroke="%23000" stroke-width="1"/></svg>') 16 16, auto`,
  },
];

// ============ BANNERS ============
export const BANNER_PRESETS: BannerPresetDef[] = [
  { slug: "aurora",    name: "Aurora",         rarity: "basico",     requirement: { type: "free" },                gradient: "linear-gradient(135deg,#0f1a3d 0%,#2b1055 40%,#7597de 80%,#ff6b9d 100%)" },
  { slug: "sakura-g",  name: "Sakura",         rarity: "basico",     requirement: { type: "level", value: 5 },     gradient: "linear-gradient(135deg,#0d0221 0%,#4a1942 45%,#e75480 100%)" },
  { slug: "cyber",     name: "Cyber city",     rarity: "especial",   requirement: { type: "level", value: 10 },    gradient: "linear-gradient(135deg,#000428 0%,#004e92 50%,#ff005c 100%)" },
  { slug: "sunset",    name: "Atardecer",      rarity: "especial",   requirement: { type: "premium" },             gradient: "linear-gradient(135deg,#2b0a3d 0%,#ff5f6d 60%,#ffc371 100%)" },
  { slug: "ocean",     name: "Océano",         rarity: "raro",       requirement: { type: "premium" },             gradient: "linear-gradient(135deg,#001f3f 0%,#0074d9 50%,#7fdbff 100%)" },
  { slug: "forest",    name: "Bosque místico", rarity: "raro",       requirement: { type: "premium" },             gradient: "linear-gradient(135deg,#0b3d0b 0%,#245c2f 50%,#a6ff96 100%)" },
  { slug: "noir",      name: "Noir",           rarity: "especial",   requirement: { type: "premium" },             gradient: "linear-gradient(135deg,#0a0a0a 0%,#2b2b2b 50%,#e5e5e5 100%)" },
  { slug: "gold",      name: "Dorado",         rarity: "mitico",     requirement: { type: "premium" },             gradient: "linear-gradient(135deg,#1a1200 0%,#5c3d00 40%,#f5c542 80%,#fff2b3 100%)" },
  // Ilustraciones IA
  { slug: "lotus",     name: "Loto",             rarity: "raro",       requirement: { type: "level", value: 6 },   gradient: `url("${bannerLotus}") center/cover no-repeat` },
  { slug: "higanbana", name: "Higanbana (muerte)", rarity: "mitico",   requirement: { type: "level", value: 12 },  gradient: `url("${bannerHiganbana}") center/cover no-repeat` },
  { slug: "ninjas",    name: "Ninjas nocturnos",   rarity: "mitico",   requirement: { type: "level", value: 15 },  gradient: `url("${bannerNinjas}") center/cover no-repeat` },
  { slug: "swords",    name: "Espadas caídas",     rarity: "legendario", requirement: { type: "level", value: 22 }, gradient: `url("${bannerSwords}") center/cover no-repeat` },
  { slug: "isekai",    name: "Isekai",             rarity: "legendario", requirement: { type: "premium" },           gradient: `url("${bannerIsekai}") center/cover no-repeat` },
  { slug: "magic",     name: "Magia elemental",    rarity: "legendario", requirement: { type: "premium" },           gradient: `url("${bannerMagic}") center/cover no-repeat` },
  { slug: "eyes",      name: "Ojos ancestrales",   rarity: "z",          requirement: { type: "gacha" },             gradient: `url("${bannerEyes}") center/cover no-repeat` },
  { slug: "roses",     name: "Rosas de sangre",    rarity: "mitico",     requirement: { type: "premium" },           gradient: `url("${bannerRoses}") center/cover no-repeat` },
  // ── Z: 3 banners exclusivos gacha ──
  { slug: "z-abyss",   name: "El abismo (Z)",      rarity: "z",          requirement: { type: "gacha" },             gradient: `url("${bannerZAbyss}") center/cover no-repeat` },
  { slug: "z-king",    name: "Rey del trono Z",    rarity: "z",          requirement: { type: "gacha" },             gradient: `url("${bannerZKing}") center/cover no-repeat` },
  { slug: "z-void",    name: "Guardián del vacío",    rarity: "legendario", requirement: { type: "gacha" },             gradient: `url("${bannerZVoid}") center/cover no-repeat` },
  // Nuevos banners naturalistas
  { slug: "sakura-trees",     name: "Cerezos en flor (Z)", rarity: "z",          requirement: { type: "gacha" },            gradient: `url("${bannerSakuraTrees}") center/cover no-repeat` },
  { slug: "swamp-far-red",    name: "Pantano lejano",      rarity: "mitico",     requirement: { type: "level", value: 18 }, gradient: `url("${bannerSwampFarRed}") center/cover no-repeat` },
  { slug: "swamp-close-red",  name: "Loto rojo en el lodo",rarity: "legendario", requirement: { type: "level", value: 24 }, gradient: `url("${bannerSwampCloseRed}") center/cover no-repeat` },
  { slug: "swamp-close-blue", name: "Loto azul lunar",     rarity: "legendario", requirement: { type: "premium" },          gradient: `url("${bannerSwampCloseBlue}") center/cover no-repeat` },
];

export function isCosmeticUnlocked(
  req: CosmeticRequirement,
  ctx: { level: number; isPremium: boolean; ownedGacha?: Set<string>; slug?: string }
): boolean {
  if (req.type === "free") return true;
  if (req.type === "premium") return ctx.isPremium;
  if (req.type === "level") return ctx.level >= req.value;
  if (req.type === "gacha") return !!(ctx.ownedGacha && ctx.slug && ctx.ownedGacha.has(ctx.slug));
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

/** Requisito serializado desde admin_* a nuestro tipo. */
export function reqFromAdmin(type: string, value: number): CosmeticRequirement {
  if (type === "premium") return { type: "premium" };
  if (type === "gacha") return { type: "gacha" };
  if (type === "level") return { type: "level", value: Math.max(0, value | 0) };
  return { type: "free" };
}
