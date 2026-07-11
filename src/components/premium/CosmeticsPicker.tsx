import { useMemo, useState } from "react";
import { Lock, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserXP } from "@/hooks/useUserXP";
import { useUserCosmetics } from "@/hooks/useUserCosmetics";
import { useAdminBanners } from "@/hooks/useAdminBanners";
import { useAdminFrames } from "@/hooks/useAdminFrames";
import { useGacha, inventorySlugSet } from "@/hooks/useGacha";
import {
  AVATAR_FRAMES, NAME_EFFECTS, CURSOR_THEMES, BANNER_PRESETS,
  isCosmeticUnlocked, RARITY_META,
  type CosmeticRequirement, type BannerPresetDef, type AvatarFrameDef, type NameEffectDef,

} from "@/lib/cosmetics";
import AvatarFrame from "./AvatarFrame";
import UserName from "./UserName";
import GachaPanel from "./GachaPanel";

type Tab = "frame" | "name" | "cursor" | "banner" | "gacha";

function reqLabel(req: CosmeticRequirement): string {
  if (req.type === "free") return "Gratis";
  if (req.type === "premium") return "Premium";
  if (req.type === "gacha") return "Gachapón Z";
  return `Nivel ${req.value}`;
}

export default function CosmeticsPicker() {
  const [tab, setTab] = useState<Tab>("frame");
  const { user, isPremium, profile, isOwner } = useAuth();
  const { xp } = useUserXP();
  const { cosmetics, update } = useUserCosmetics();
  const { banners: adminBanners } = useAdminBanners();
  const { frames: adminFrames } = useAdminFrames();
  const { inventory } = useGacha();

  const ownedBanners = useMemo(() => inventorySlugSet(inventory, "banner"), [inventory]);
  const ownedFrames  = useMemo(() => inventorySlugSet(inventory, "frame"), [inventory]);
  const ownedNames   = useMemo(() => inventorySlugSet(inventory, "name"), [inventory]);

  const allBanners = useMemo<BannerPresetDef[]>(() => [...BANNER_PRESETS, ...adminBanners], [adminBanners]);
  const allFrames  = useMemo<AvatarFrameDef[]>(() => [...AVATAR_FRAMES, ...adminFrames], [adminFrames]);

  const displayName = profile?.display_name || profile?.username || "Tu nombre";

  if (!user) return null;

  const tabs: { id: Tab; label: string; icon?: any }[] = [
    { id: "frame", label: "Marco" },
    { id: "name", label: "Nombre" },
    { id: "cursor", label: "Cursor" },
    { id: "banner", label: "Banner" },
    { id: "gacha", label: "Gachapón Z", icon: Sparkles },
  ];

  const tryUpdate = async (patch: Partial<typeof cosmetics>, unlocked: boolean, reqTxt: string) => {
    if (!unlocked) {
      toast.error(`Requiere: ${reqTxt}`);
      return;
    }
    try {
      await update(patch);
      toast.success("Personalización guardada");
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e?.message ?? "error"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition",
              tab === t.id
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* MARCOS */}
      {tab === "frame" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {allFrames.map((f) => {
            const unlocked = isCosmeticUnlocked(f.requirement, { level: xp.level, isPremium, ownedGacha: ownedFrames, slug: f.slug, isOwner });
            const active = cosmetics.avatar_frame === f.slug;
            const meta = RARITY_META[f.rarity];
            return (
              <button
                key={f.slug}
                onClick={() => tryUpdate({ avatar_frame: f.slug }, unlocked, reqLabel(f.requirement))}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-3 rounded-xl border transition",
                  active ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                  !unlocked && "opacity-60"
                )}
              >
                <AvatarFrame frame={f.slug} size={64}>
                  <div className="w-full h-full bg-secondary" />
                </AvatarFrame>
                <span className="text-xs font-medium truncate max-w-full">{f.name}</span>
                <span className="rarity-chip" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-[10px] text-muted-foreground">{reqLabel(f.requirement)}</span>
                {active && <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                {!unlocked && <Lock className="absolute top-2 left-2 w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      )}

      {/* NOMBRES */}
      {tab === "name" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {NAME_EFFECTS.map((f) => {
            const unlocked = isCosmeticUnlocked(f.requirement, { level: xp.level, isPremium, ownedGacha: ownedNames, slug: f.slug, isOwner });
            const active = cosmetics.name_effect === f.slug;
            const meta = RARITY_META[f.rarity];
            return (
              <button
                key={f.slug}
                onClick={() => tryUpdate({ name_effect: f.slug }, unlocked, reqLabel(f.requirement))}
                className={cn(
                  "relative flex items-center justify-between gap-3 p-3 rounded-xl border transition",
                  active ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                  !unlocked && "opacity-60"
                )}
              >
                <div className="flex flex-col items-start gap-1">
                  <UserName name={displayName} effect={f.slug} className="text-lg font-bold" />
                  <div className="flex items-center gap-2">
                    <span className="rarity-chip" style={{ color: meta.color }}>{meta.label}</span>
                    <span className="text-[10px] text-muted-foreground">{f.name} · {reqLabel(f.requirement)}</span>
                  </div>
                </div>
                {active && <Check className="w-4 h-4 text-primary" />}
                {!unlocked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      )}

      {/* CURSOR */}
      {tab === "cursor" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CURSOR_THEMES.map((f) => {
            const unlocked = isCosmeticUnlocked(f.requirement, { level: xp.level, isPremium, isOwner });
            const active = cosmetics.cursor_theme === f.slug;
            const meta = RARITY_META[f.rarity];
            return (
              <button
                key={f.slug}
                onClick={() => tryUpdate({ cursor_theme: f.slug }, unlocked, reqLabel(f.requirement))}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition min-h-[100px]",
                  active ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                  !unlocked && "opacity-60"
                )}
                style={{ cursor: unlocked ? f.cursor : "not-allowed" }}
              >
                <span className="text-sm font-medium">{f.name}</span>
                <span className="rarity-chip" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-[10px] text-muted-foreground">{reqLabel(f.requirement)}</span>
                {active && <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                {!unlocked && <Lock className="absolute top-2 left-2 w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            );
          })}
          <p className="col-span-full text-xs text-muted-foreground">
            Los cursores personalizados solo se activan en PC (dispositivos con puntero).
          </p>
        </div>
      )}

      {/* BANNER */}
      {tab === "banner" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {allBanners.map((b) => {
            const unlocked = isCosmeticUnlocked(b.requirement, { level: xp.level, isPremium, ownedGacha: ownedBanners, slug: b.slug, isOwner });
            const active = cosmetics.banner_preset === b.slug && !cosmetics.banner_url;
            const meta = RARITY_META[b.rarity];
            return (
              <button
                key={b.slug}
                onClick={() => tryUpdate({ banner_preset: b.slug, banner_url: null }, unlocked, reqLabel(b.requirement))}
                className={cn(
                  "relative rounded-xl border overflow-hidden aspect-[16/6] group transition",
                  active ? "border-primary ring-2 ring-primary" : `border-border hover:border-primary/50`,
                  !unlocked && "opacity-60"
                )}
                style={{ background: b.gradient, boxShadow: active ? `0 0 12px ${meta.color}80` : undefined }}
              >
                <div className="absolute inset-0 flex items-end justify-between p-2 bg-gradient-to-t from-black/70 to-transparent">
                  <span className="text-xs font-semibold text-white truncate">{b.name}</span>
                  <span className="rarity-chip bg-black/40" style={{ color: meta.color }}>{meta.label}</span>
                </div>
                <span className="absolute top-2 right-2 text-[10px] text-white/80">{reqLabel(b.requirement)}</span>
                {active && <Check className="absolute top-2 left-8 w-4 h-4 text-white drop-shadow" />}
                {!unlocked && <Lock className="absolute top-2 left-2 w-3.5 h-3.5 text-white/80" />}
              </button>
            );
          })}
        </div>
      )}

      {/* GACHAPÓN */}
      {tab === "gacha" && <GachaPanel />}
    </div>
  );
}
