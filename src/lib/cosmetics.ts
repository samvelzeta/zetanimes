// Catálogo de cosméticos premium + sistema de rareza.
// Imágenes servidas desde Cloudflare R2 con Cache-Control: public, max-age=31536000, immutable
// (el navegador las guarda ~1 año, minimizando peticiones repetidas al bucket).

const R2 = "https://pub-e2479e62bcc84fb097a7117ec086f7e7.r2.dev";
const b = (f: string) => `${R2}/banners/${f}`;
const fr = (f: string) => `${R2}/frames/${f}`;

// ===== Banners =====
const bannerHiganbana = b("banner-higanbana.jpg");
const bannerLotus = b("banner-lotus.jpg");
const bannerRoses = b("banner-roses.jpg");
const bannerNinjas = b("banner-ninjas.jpg");
const bannerIsekai = b("banner-isekai.jpg");
const bannerSwords = b("banner-swords.jpg");
const bannerMagic = b("banner-magic.jpg");
const bannerEyes = b("banner-eyes.jpg");
const bannerZAbyss = b("banner-z-abyss.jpg");
const bannerZKing = b("banner-z-king.jpg");
const bannerZVoid = b("banner-z-void.jpg");
const bannerSakuraTrees = b("banner-sakura-trees.jpg");
const bannerSwampFarRed = b("banner-swamp-far-red.jpg");
const bannerSwampCloseRed = b("banner-swamp-close-red.jpg");
const bannerSwampCloseBlue = b("banner-swamp-close-blue.jpg");
const bannerMoorland = b("banner-moorland.jpg");
const bannerGears = b("banner-gears.jpg");
const bannerJjOra = b("banner-jj-ora.jpg");
const bannerJjHamon = b("banner-jj-hamon.jpg");
const bannerJjMuda = b("banner-jj-muda.jpg");
const bannerJjWry = b("banner-jj-wry.jpg");
const bannerJjHeyBaby = b("banner-jj-heybaby.jpg");
const bannerJjSugiNi = b("banner-jj-sugini.jpg");
const bannerJjWha = b("banner-jj-wha.jpg");
const bannerJjShiza = b("banner-jj-shiza.jpg");
const bannerJjZaWarudo = b("banner-jj-zawarudo.jpg");
const bannerJjStarFinger = b("banner-jj-starfinger.jpg");
const bannerJjYatta = b("banner-jj-yatta.jpg");
const bannerJjGoldExperience = b("banner-jj-goldexperience.jpg");
const bannerJjKingCrimson = b("banner-jj-kingcrimson.jpg");
const bannerJjVine = b("banner-jj-vine.jpg");
const bannerJjStab = b("banner-jj-stab.jpg");
const bannerJjScrape = b("banner-jj-scrape.jpg");
const bannerJjExplosion = b("banner-jj-explosion.jpg");
const bannerJjLife = b("banner-jj-life.jpg");
const bannerJjHeavensDoor = b("banner-jj-heavensdoor.jpg");
const bannerJjYattaTriple = b("banner-jj-yatta-triple.jpg");
const bannerJjMadeInHeaven = b("banner-jj-madeinheaven.jpg");

// ===== Marcos 3D (PNG con hueco transparente) =====
const frameRoses = fr("frame-roses.png");
const frameSwords = fr("frame-swords.png");
const framePetals = fr("frame-petals.png");
const frameThorns = fr("frame-thorns.png");
const frameDragon = fr("frame-dragon.png");
const frameWings = fr("frame-wings.png");
const frameFlames = fr("frame-flames.png");
const frameCrown = fr("frame-crown.png");
const frameDemon = fr("frame-demon.png");
const frameCosmic = fr("frame-cosmic.png");
const frameBlood = fr("frame-blood.png");
const frameLotusRed = fr("frame-lotus-red.png");
const frameLotusBlue = fr("frame-lotus-blue.png");
const frameSkullHands = fr("frame-skull-hands.png");
const frameVikingHelm = fr("frame-viking-helm.png");
const frameOni = fr("frame-oni.png");
const frameTwinBlades = fr("frame-twin-blades.png");
const frameJjHamon = fr("frame-jj-hamon.png");
const frameJjNavy = fr("frame-jj-navy.png");
const frameJjDarkPink = fr("frame-jj-darkpink.png");
const frameJjPurple = fr("frame-jj-purple.png");
const frameJjCrimson = fr("frame-jj-crimson.png");
const frameJjObsidian = fr("frame-jj-obsidian.png");
const frameJjStone = fr("frame-jj-stone.png");
const frameJjCyan = fr("frame-jj-cyan.png");
const frameJjGoldenArrow = fr("frame-jj-golden-arrow.png");
const frameJjAmber = fr("frame-jj-amber.png");
const frameJjMagenta = fr("frame-jj-magenta.png");
const frameJjGreen = fr("frame-jj-green.png");
const frameJjDeepRed = fr("frame-jj-deepred.png");
const frameJjIndigo = fr("frame-jj-indigo.png");
const frameJjViolet = fr("frame-jj-violet.png");
const frameJjMirror = fr("frame-jj-mirror.png");
const frameJjCrimsonSwirl = fr("frame-jj-crimson-swirl.png");
const frameJjStandThreads = fr("frame-jj-stand-threads.png");
const frameJjSeraphim = fr("frame-jj-seraphim.png");
const frameJjSapphireDragon = fr("frame-jj-sapphire-dragon.png");
const frameJjPortal = fr("frame-jj-portal.png");

// Referencias no usadas actualmente pero mantenidas para compatibilidad futura
void frameJjDarkPink; void frameJjCrimson; void frameJjStone; void frameJjMagenta;
void frameJjGreen; void frameJjDeepRed; void frameJjViolet; void frameJjCrimsonSwirl;
void frameJjStandThreads; void frameJjPortal;

export type Rarity = "basico" | "especial" | "raro" | "mitico" | "legendario" | "z";

export const RARITIES: Rarity[] = ["basico", "especial", "raro", "mitico", "legendario", "z"];

export const RARITY_META: Record<Rarity, { label: string; color: string; ring: string; glow: string; chance: number }> = {
  basico: { label: "Básico", color: "#94a3b8", ring: "ring-slate-400/40", glow: "0 0 6px rgba(148,163,184,0.4)", chance: 0.80 },
  especial: { label: "Especial", color: "#10b981", ring: "ring-emerald-400/50", glow: "0 0 10px rgba(16,185,129,0.5)", chance: 0.14 },
  raro: { label: "Raro", color: "#3b82f6", ring: "ring-blue-400/60", glow: "0 0 14px rgba(59,130,246,0.6)", chance: 0.045 },
  mitico: { label: "Mítico", color: "#a855f7", ring: "ring-purple-400/70", glow: "0 0 18px rgba(168,85,247,0.7)", chance: 0.012 },
  legendario: { label: "Legendario", color: "#f59e0b", ring: "ring-amber-400/80", glow: "0 0 22px rgba(245,158,11,0.85)", chance: 0.0028 },
  z: { label: "Z", color: "#ff005c", ring: "ring-rose-500", glow: "0 0 26px rgba(255,0,92,0.95)", chance: 0.0002 },
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
  previewText?: string;
  previewClassName?: string;
}

// ============ MARCOS ============
export const AVATAR_FRAMES: AvatarFrameDef[] = [
  { slug: "default", name: "Sin marco", className: "zf-frame-default", shape: "circle", rarity: "basico", requirement: { type: "free" } },
  { slug: "neon-orange", name: "Neón Zet", className: "zf-frame-neon", shape: "circle", rarity: "basico", requirement: { type: "level", value: 50 } },
  { slug: "sakura", name: "Sakura", className: "zf-frame-sakura", shape: "circle", rarity: "basico", requirement: { type: "level", value: 50 } },
  { slug: "hex-neon", name: "Hexágono neón", className: "zf-frame-neon", shape: "hex", rarity: "especial", requirement: { type: "level", value: 70 } },
  { slug: "shield-fire", name: "Escudo llameante", className: "zf-frame-fire", shape: "shield", rarity: "especial", requirement: { type: "level", value: 70 } },
  { slug: "diamond-ice", name: "Diamante de hielo", className: "zf-frame-neon", shape: "diamond", rarity: "raro", requirement: { type: "level", value: 90 } },
  { slug: "star-gold", name: "Estrella dorada", className: "zf-frame-gold", shape: "star", rarity: "raro", requirement: { type: "premium" } },
  { slug: "rainbow", name: "Arcoíris", className: "zf-frame-rainbow", shape: "circle", rarity: "mitico", requirement: { type: "level", value: 120 } },

  // ── Marcos artísticos 3D con overlay PNG ──
  { slug: "art-petals", name: "Pétalos de sakura", className: "zf-frame-art", shape: "circle", imageUrl: framePetals, rarity: "basico", requirement: { type: "level", value: 50 } },
  { slug: "art-flames", name: "Aro de fuego azul", className: "zf-frame-art", shape: "circle", imageUrl: frameFlames, rarity: "especial", requirement: { type: "level", value: 70 } },
  { slug: "art-thorns", name: "Espinas malditas", className: "zf-frame-art", shape: "circle", imageUrl: frameThorns, rarity: "especial", requirement: { type: "level", value: 70 } },
  { slug: "art-swords", name: "Espadas cruzadas", className: "zf-frame-art", shape: "circle", imageUrl: frameSwords, rarity: "raro", requirement: { type: "level", value: 90 } },
  { slug: "art-roses", name: "Rosas y espinas", className: "zf-frame-art", shape: "circle", imageUrl: frameRoses, rarity: "raro", requirement: { type: "premium" } },
  { slug: "art-wings", name: "Alas celestiales", className: "zf-frame-art", shape: "circle", imageUrl: frameWings, rarity: "mitico", requirement: { type: "premium" } },
  { slug: "art-crown", name: "Corona real", className: "zf-frame-art", shape: "circle", imageUrl: frameCrown, rarity: "mitico", requirement: { type: "gacha" } },
  { slug: "art-dragon", name: "Dragón dorado", className: "zf-frame-art", shape: "circle", imageUrl: frameDragon, rarity: "legendario", requirement: { type: "gacha" } },
  { slug: "art-lotus-red", name: "Loto rojo", className: "zf-frame-art", shape: "circle", imageUrl: frameLotusRed, rarity: "mitico", requirement: { type: "level", value: 120 } },
  { slug: "art-lotus-blue", name: "Loto azul", className: "zf-frame-art", shape: "circle", imageUrl: frameLotusBlue, rarity: "mitico", requirement: { type: "gacha" } },

  // ── Z existentes ──
  { slug: "z-demon", name: "Portal demoníaco", className: "zf-frame-art zf-frame-z", shape: "circle", imageUrl: frameDemon, rarity: "z", requirement: { type: "gacha" } },
  { slug: "z-cosmic", name: "Fénix cósmico", className: "zf-frame-art zf-frame-z", shape: "circle", imageUrl: frameCosmic, rarity: "z", requirement: { type: "gacha" } },
  { slug: "z-blood", name: "Sangre eterna", className: "zf-frame-art zf-frame-z zf-frame-blood", shape: "circle", imageUrl: frameBlood, rarity: "z", requirement: { type: "gacha" } },
  { slug: "z-skull-hands", name: "Guardianes óseos", className: "zf-frame-art zf-frame-skull", shape: "circle", imageUrl: frameSkullHands, rarity: "z", requirement: { type: "gacha" } },
  { slug: "viking", name: "Casco de Odín", className: "zf-frame-art zf-frame-viking", shape: "circle", imageUrl: frameVikingHelm, rarity: "legendario", requirement: { type: "gacha" } },
  { slug: "twin-blades", name: "Espadas gemelas", className: "zf-frame-art zf-frame-twin", shape: "circle", imageUrl: frameTwinBlades, rarity: "legendario", requirement: { type: "gacha" } },
  { slug: "oni", name: "Máscara Oni", className: "zf-frame-art zf-frame-oni", shape: "circle", imageUrl: frameOni, rarity: "legendario", requirement: { type: "level", value: 100 } },

  // ── JOJO'S GACHAPÓN ──
  // NOTA: se retiraron los marcos con diseños que invadían el centro del avatar
  // (Portal Jojolion, Espinas del Amor, Reliquia de Piedra, Araña de Ocupantes,
  // Tumba de Esmeralda, Loto de Giorno, Cresta de Araña, Corona del Rey No Muerto,
  // Filamento de Stand y Remolino Carmesí) porque obstruían la foto de perfil.
  { slug: "jj-hiedra-destino", name: "Hiedra del Destino", className: "zf-frame-art", shape: "circle", imageUrl: frameJjHamon, rarity: "basico", requirement: { type: "gacha" } },
  { slug: "jj-estrella-mar", name: "Estrella de Mar", className: "zf-frame-art", shape: "circle", imageUrl: frameJjNavy, rarity: "basico", requirement: { type: "gacha" } },
  { slug: "jj-cadenas-almas", name: "Cadenas de Almas", className: "zf-frame-art", shape: "circle", imageUrl: frameJjPurple, rarity: "legendario", requirement: { type: "gacha" } },
  { slug: "jj-sombra-vampiro", name: "Sombra del Vampiro", className: "zf-frame-art", shape: "circle", imageUrl: frameJjObsidian, rarity: "basico", requirement: { type: "gacha" } },

  { slug: "jj-daga-warudo", name: "Daga de Za Warudo", className: "zf-frame-art", shape: "circle", imageUrl: frameJjCyan, rarity: "especial", requirement: { type: "gacha" } },
  { slug: "jj-ankh-desierto", name: "Ankh del Desierto", className: "zf-frame-art", shape: "circle", imageUrl: frameJjAmber, rarity: "especial", requirement: { type: "gacha" } },

  { slug: "jj-estrella-jojoniana", name: "Estrella Jojoniana", className: "zf-frame-art", shape: "circle", imageUrl: frameJjIndigo, rarity: "mitico", requirement: { type: "gacha" } },

  { slug: "jj-espejo-almas", name: "Espejo de Almas", className: "zf-frame-art", shape: "circle", imageUrl: frameJjMirror, rarity: "raro", requirement: { type: "gacha" } },

  { slug: "jj-golden-evolution", name: "Golden Evolution", className: "zf-frame-art", shape: "circle", imageUrl: frameJjGoldenArrow, rarity: "legendario", requirement: { type: "gacha" } },
  { slug: "jj-serafin", name: "Alas de Serafín", className: "zf-frame-art zf-frame-serafin", shape: "circle", imageUrl: frameJjSeraphim, rarity: "z", requirement: { type: "gacha" } },
  { slug: "jj-dragon-abismo", name: "Dragón del Abismo", className: "zf-frame-art", shape: "circle", imageUrl: frameJjSapphireDragon, rarity: "legendario", requirement: { type: "gacha" } },
];

export const NAME_EFFECTS: NameEffectDef[] = [
  { slug: "default", name: "Normal", className: "", rarity: "basico", requirement: { type: "free" } },
  { slug: "shiny", name: "Brillante", className: "zf-name-shiny", rarity: "especial", requirement: { type: "level", value: 50 } },
  { slug: "neon", name: "Neón", className: "zf-name-neon", rarity: "especial", requirement: { type: "level", value: 50 } },
  { slug: "gradient", name: "Gradiente", className: "zf-name-gradient", rarity: "raro", requirement: { type: "level", value: 70 } },
  { slug: "toxic", name: "Tóxico", className: "zf-name-toxic", rarity: "raro", requirement: { type: "level", value: 70 } },
  { slug: "gold", name: "Dorado", className: "zf-name-gold", rarity: "raro", requirement: { type: "level", value: 70 } },
  { slug: "fire", name: "Fuego", className: "zf-name-fire", rarity: "mitico", requirement: { type: "premium" } },
  { slug: "ice", name: "Hielo", className: "zf-name-ice", rarity: "mitico", requirement: { type: "premium" } },
  { slug: "blood", name: "Sangre", className: "zf-name-blood", rarity: "mitico", requirement: { type: "level", value: 90 } },
  { slug: "galaxy", name: "Galaxia", className: "zf-name-galaxy", rarity: "mitico", requirement: { type: "premium" } },
  { slug: "glitch", name: "Glitch", className: "zf-name-glitch", rarity: "legendario", requirement: { type: "level", value: 120 } },
  { slug: "rainbow", name: "Arcoíris", className: "zf-name-rainbow", rarity: "legendario", requirement: { type: "level", value: 120 } },
  { slug: "void", name: "Vacío", className: "zf-name-void", rarity: "legendario", requirement: { type: "gacha" } },
  { slug: "ink-drip", name: "Tinta escurriendo", className: "zf-name-ink-drip", rarity: "legendario", requirement: { type: "level", value: 120 } },
  { slug: "neon-vein", name: "Neón sangre", className: "zf-name-neon-vein", rarity: "legendario", requirement: { type: "level", value: 120 } },
  { slug: "z-name", name: "Aura Z", className: "zf-name-z", rarity: "z", requirement: { type: "gacha" } },
];

export const CURSOR_THEMES: CursorThemeDef[] = [
  { slug: "default", name: "Sistema", cursor: "auto", rarity: "basico", requirement: { type: "free" } },
  {
    slug: "katana", name: "Katana", rarity: "especial", requirement: { type: "level", value: 50 },
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><line x1="4" y1="28" x2="26" y2="6" stroke="%23ff4500" stroke-width="3" stroke-linecap="round"/><line x1="4" y1="28" x2="26" y2="6" stroke="%23fff" stroke-width="1" stroke-linecap="round"/><rect x="2" y="26" width="6" height="4" fill="%23222" transform="rotate(-45 5 28)"/></g></svg>') 4 28, auto`,
  },
  {
    slug: "kunai", name: "Kunai", rarity: "especial", requirement: { type: "level", value: 50 },
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="%23888" stroke="%23000" stroke-width="0.5"><polygon points="16,2 20,14 16,26 12,14"/><rect x="14" y="20" width="4" height="8" fill="%23444"/></g></svg>') 16 2, auto`,
  },
  {
    slug: "daga", name: "Daga", rarity: "raro", requirement: { type: "level", value: 70 },
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><polygon points="16,2 18,20 16,24 14,20" fill="%23cfd8dc" stroke="%23000" stroke-width="0.8"/><rect x="12" y="22" width="8" height="3" fill="%238b5a2b"/><rect x="14" y="24" width="4" height="6" fill="%235a3c1e"/><circle cx="16" cy="30" r="1.5" fill="%23ffd700"/></g></svg>') 16 2, auto`,
  },
  {
    slug: "flecha", name: "Flecha", rarity: "raro", requirement: { type: "level", value: 70 },
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g><line x1="4" y1="28" x2="24" y2="8" stroke="%238b5a2b" stroke-width="2"/><polygon points="28,4 22,6 24,10 20,12" fill="%23cfd8dc" stroke="%23000" stroke-width="0.6"/><polygon points="2,30 6,26 4,24 8,22 6,20 2,26" fill="%23e53935"/></g></svg>') 28 4, auto`,
  },
  {
    slug: "hacha", name: "Hacha", rarity: "raro", requirement: { type: "level", value: 70 },
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
    slug: "star", name: "Estrella", rarity: "legendario", requirement: { type: "level", value: 120 },
    cursor: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><polygon points="16,2 20,12 30,12 22,18 26,28 16,22 6,28 10,18 2,12 12,12" fill="%23ffcc00" stroke="%23000" stroke-width="1"/></svg>') 16 16, auto`,
  },
];

// ============ BANNERS ============
export const BANNER_PRESETS: BannerPresetDef[] = [
  { slug: "aurora", name: "Aurora", rarity: "basico", requirement: { type: "free" }, gradient: "linear-gradient(135deg,#0f1a3d 0%,#2b1055 40%,#7597de 80%,#ff6b9d 100%)" },
  { slug: "sakura-g", name: "Sakura", rarity: "basico", requirement: { type: "level", value: 30 }, gradient: "linear-gradient(135deg,#0d0221 0%,#4a1942 45%,#e75480 100%)" },
  { slug: "cyber", name: "Cyber city", rarity: "especial", requirement: { type: "level", value: 50 }, gradient: "linear-gradient(135deg,#000428 0%,#004e92 50%,#ff005c 100%)" },
  { slug: "sunset", name: "Atardecer", rarity: "especial", requirement: { type: "premium" }, gradient: "linear-gradient(135deg,#2b0a3d 0%,#ff5f6d 60%,#ffc371 100%)" },
  { slug: "ocean", name: "Océano", rarity: "raro", requirement: { type: "premium" }, gradient: "linear-gradient(135deg,#001f3f 0%,#0074d9 50%,#7fdbff 100%)" },
  { slug: "forest", name: "Bosque místico", rarity: "raro", requirement: { type: "premium" }, gradient: "linear-gradient(135deg,#0b3d0b 0%,#245c2f 50%,#a6ff96 100%)" },
  { slug: "noir", name: "Noir", rarity: "especial", requirement: { type: "premium" }, gradient: "linear-gradient(135deg,#0a0a0a 0%,#2b2b2b 50%,#e5e5e5 100%)" },
  { slug: "gold", name: "Dorado", rarity: "mitico", requirement: { type: "premium" }, gradient: "linear-gradient(135deg,#1a1200 0%,#5c3d00 40%,#f5c542 80%,#fff2b3 100%)" },

  // Ilustraciones IA existentes
  { slug: "lotus", name: "Loto", rarity: "raro", requirement: { type: "level", value: 70 }, gradient: `url("${bannerLotus}") center/cover no-repeat` },
  { slug: "higanbana", name: "Higanbana (muerte)", rarity: "mitico", requirement: { type: "level", value: 90 }, gradient: `url("${bannerHiganbana}") center/cover no-repeat` },
  { slug: "ninjas", name: "Ninjas nocturnos", rarity: "mitico", requirement: { type: "level", value: 90 }, gradient: `url("${bannerNinjas}") center/cover no-repeat` },
  { slug: "swords", name: "Espadas caídas", rarity: "legendario", requirement: { type: "level", value: 120 }, gradient: `url("${bannerSwords}") center/cover no-repeat` },
  { slug: "isekai", name: "Isekai", rarity: "legendario", requirement: { type: "premium" }, gradient: `url("${bannerIsekai}") center/cover no-repeat` },
  { slug: "magic", name: "Magia elemental", rarity: "legendario", requirement: { type: "premium" }, gradient: `url("${bannerMagic}") center/cover no-repeat` },
  { slug: "eyes", name: "Ira de Zen", rarity: "z", requirement: { type: "gacha" }, gradient: `url("${bannerEyes}") center/cover no-repeat` },
  { slug: "roses", name: "Rosas de sangre", rarity: "mitico", requirement: { type: "premium" }, gradient: `url("${bannerRoses}") center/cover no-repeat` },
  { slug: "z-abyss", name: "El abismo (Z)", rarity: "z", requirement: { type: "gacha" }, gradient: `url("${bannerZAbyss}") center/cover no-repeat` },
  { slug: "z-king", name: "Rey del trono Z", rarity: "z", requirement: { type: "gacha" }, gradient: `url("${bannerZKing}") center/cover no-repeat` },
  { slug: "z-void", name: "Guardián del vacío", rarity: "legendario", requirement: { type: "gacha" }, gradient: `url("${bannerZVoid}") center/cover no-repeat` },
  { slug: "sakura-trees", name: "Cerezos en flor (Z)", rarity: "z", requirement: { type: "gacha" }, gradient: `url("${bannerSakuraTrees}") center/cover no-repeat` },
  { slug: "swamp-far-red", name: "Pantano lejano", rarity: "mitico", requirement: { type: "level", value: 90 }, gradient: `url("${bannerSwampFarRed}") center/cover no-repeat` },
  { slug: "swamp-close-red", name: "Loto rojo en el lodo", rarity: "legendario", requirement: { type: "level", value: 120 }, gradient: `url("${bannerSwampCloseRed}") center/cover no-repeat` },
  { slug: "swamp-close-blue", name: "Loto azul lunar", rarity: "legendario", requirement: { type: "premium" }, gradient: `url("${bannerSwampCloseBlue}") center/cover no-repeat` },
  { slug: "moorland", name: "Páramo desolado", rarity: "legendario", requirement: { type: "gacha" }, gradient: `url("${bannerMoorland}") center/cover no-repeat` },
  { slug: "gears", name: "Engranajes del rey", rarity: "mitico", requirement: { type: "level", value: 50 }, gradient: `url("${bannerGears}") center/cover no-repeat` },

  // ── JOJO'S GACHAPÓN: básicos ──
  { slug: "jj-jotaro-pose", name: "Jotaro's Pose", rarity: "basico", requirement: { type: "gacha" }, gradient: `url("${bannerJjOra}") center/cover no-repeat`, previewText: "ORA!", previewClassName: "zf-banner-impact" },
  { slug: "jj-ripple", name: "Ripple", rarity: "basico", requirement: { type: "gacha" }, gradient: `url("${bannerJjHamon}") center/cover no-repeat`, previewText: "HAMON!", previewClassName: "zf-banner-hamon" },
  { slug: "jj-dio-laugh", name: "Dio's Laugh", rarity: "basico", requirement: { type: "gacha" }, gradient: `url("${bannerJjMuda}") center/cover no-repeat`, previewText: "MUDA!", previewClassName: "zf-banner-slash" },
  { slug: "jj-dio-scream", name: "Dio's Scream", rarity: "basico", requirement: { type: "gacha" }, gradient: `url("${bannerJjWry}") center/cover no-repeat`, previewText: "WRY!", previewClassName: "zf-banner-impact-red" },
  { slug: "jj-speedwagon-hat", name: "Speedwagon's Hat", rarity: "basico", requirement: { type: "gacha" }, gradient: `url("${bannerJjHeyBaby}") center/cover no-repeat`, previewText: "HEY BABY!", previewClassName: "zf-banner-comic" },
  { slug: "jj-joseph-trick", name: "Joseph's Trick", rarity: "mitico", requirement: { type: "gacha" }, gradient: `url("${bannerJjSugiNi}") center/cover no-repeat`, previewText: "SUGI NI!", previewClassName: "zf-banner-trick" },
  { slug: "jj-kars-pose", name: "Kars' Pose", rarity: "basico", requirement: { type: "gacha" }, gradient: `url("${bannerJjWha}") center/cover no-repeat`, previewText: "WHA-!", previewClassName: "zf-banner-comic-shock" },
  { slug: "jj-caeser-bubbles", name: "Caeser's Bubbles", rarity: "basico", requirement: { type: "gacha" }, gradient: `url("${bannerJjShiza}") center/cover no-repeat`, previewText: "SHIZA!", previewClassName: "zf-banner-bubbles" },

  // ── JOJO'S GACHAPÓN: especiales ──
  { slug: "jj-za-warudo", name: "Za Warudo", rarity: "especial", requirement: { type: "gacha" }, gradient: `url("${bannerJjZaWarudo}") center/cover no-repeat`, previewText: "ZA WARUDO!", previewClassName: "zf-banner-glitch" },
  { slug: "jj-star-finger", name: "Star Finger", rarity: "especial", requirement: { type: "gacha" }, gradient: `url("${bannerJjStarFinger}") center/cover no-repeat`, previewText: "STAR FINGER!", previewClassName: "zf-banner-stretch" },
  { slug: "jj-bites-the-dust", name: "Bites the Dust", rarity: "especial", requirement: { type: "gacha" }, gradient: `url("${bannerJjYatta}") center/cover no-repeat`, previewText: "YATTA!", previewClassName: "zf-banner-rewind" },
  { slug: "jj-gold-experience", name: "Golden Experience", rarity: "especial", requirement: { type: "gacha" }, gradient: `url("${bannerJjGoldExperience}") center/cover no-repeat`, previewText: "GOLD EXPERIENCE!", previewClassName: "zf-banner-life" },
  { slug: "jj-king-crimson", name: "King Crimson", rarity: "especial", requirement: { type: "gacha" }, gradient: `url("${bannerJjKingCrimson}") center/cover no-repeat`, previewText: "KING CRIMSON!", previewClassName: "zf-banner-crimson" },

  // ── JOJO'S GACHAPÓN: míticos ──
  { slug: "jj-purple-hermit", name: "Purple Hermit", rarity: "mitico", requirement: { type: "gacha" }, gradient: `url("${bannerJjVine}") center/cover no-repeat`, previewText: "VINE!", previewClassName: "zf-banner-vine" },
  { slug: "jj-silver-chariot", name: "Silver Chariot", rarity: "mitico", requirement: { type: "gacha" }, gradient: `url("${bannerJjStab}") center/cover no-repeat`, previewText: "STAB!", previewClassName: "zf-banner-stab" },
  { slug: "jj-the-hand", name: "The Hand", rarity: "mitico", requirement: { type: "gacha" }, gradient: `url("${bannerJjScrape}") center/cover no-repeat`, previewText: "SCRAPE!", previewClassName: "zf-banner-scrape" },

  // ── JOJO'S GACHAPÓN: épicos mapeados a raro ──
  { slug: "jj-kira-hand", name: "Kira's Hand", rarity: "raro", requirement: { type: "gacha" }, gradient: `url("${bannerJjExplosion}") center/cover no-repeat`, previewText: "EXPLOSION!", previewClassName: "zf-banner-explosion" },
  { slug: "jj-ger", name: "GER", rarity: "raro", requirement: { type: "gacha" }, gradient: `url("${bannerJjLife}") center/cover no-repeat`, previewText: "LIFE!", previewClassName: "zf-banner-life" },
  { slug: "jj-heavens-door", name: "Heaven's Door", rarity: "raro", requirement: { type: "gacha" }, gradient: `url("${bannerJjHeavensDoor}") center/cover no-repeat`, previewText: "HEAVEN'S DOOR!", previewClassName: "zf-banner-pages" },

  // ── JOJO'S GACHAPÓN: legendarios ──
  { slug: "jj-bites-the-dust-legend", name: "Bites the Dust Supremo", rarity: "legendario", requirement: { type: "gacha" }, gradient: `url("${bannerJjYattaTriple}") center/cover no-repeat`, previewText: "YATTA! YATTA! YATTA!", previewClassName: "zf-banner-rewind" },
  { slug: "jj-made-in-heaven", name: "Made in Heaven", rarity: "legendario", requirement: { type: "gacha" }, gradient: `url("${bannerJjMadeInHeaven}") center/cover no-repeat`, previewText: "MADE IN HEAVEN!", previewClassName: "zf-banner-heaven" },

];

export function isCosmeticUnlocked(
  req: CosmeticRequirement,
  ctx: { level: number; isPremium: boolean; ownedGacha?: Set<string>; slug?: string; isOwner?: boolean }
): boolean {
  if (ctx.isOwner) return true;
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
