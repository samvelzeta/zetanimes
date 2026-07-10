import { useState } from "react";
import { Sparkles, Package, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGacha, type PullResult } from "@/hooks/useGacha";
import { RARITY_META, type Rarity } from "@/lib/cosmetics";

interface Props {
  onOpenInventory?: () => void;
}

export default function GachaPanel({ onOpenInventory }: Props) {
  const { tokens, loading, pull } = useGacha();
  const [pool, setPool] = useState<"banner" | "frame">("frame");
  const [phase, setPhase] = useState<"idle" | "shake" | "burst" | "reveal">("idle");
  const [result, setResult] = useState<PullResult | null>(null);

  const pulling = phase === "shake" || phase === "burst";

  const doPull = async () => {
    if (tokens.tokens < 2) { toast.error("Necesitas 2 fichas Z. Mira más animes para ganar."); return; }
    setResult(null);
    setPhase("shake");
    try {
      await new Promise((r) => setTimeout(r, 900));
      const res = await pull(pool);
      if (!res.ok) {
        setPhase("idle");
        toast.error(res.reason === "no_tokens" ? "Sin fichas" : res.reason === "all_owned" ? "¡Ya tienes todo!" : "No se pudo tirar");
        return;
      }
      setPhase("burst");
      await new Promise((r) => setTimeout(r, 700));
      setResult(res);
      setPhase("reveal");
      if (res.special) {
        toast.success(`🎉 ¡Felicidades! Recompensa especial: ${res.name}`, { duration: 6000 });
      }
    } catch (e: any) {
      setPhase("idle");
      toast.error(e?.message ?? "error");
    }
  };

  const rarity: Rarity = (result?.rarity as Rarity) ?? "basico";
  const meta = RARITY_META[rarity];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Fichas Z</p>
            <p className="text-4xl font-thin text-primary">{loading ? "…" : tokens.tokens}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Ganadas: {tokens.total_earned} · Usadas: {tokens.total_spent}
            </p>
          </div>
          <Sparkles className="w-10 h-10 text-primary/40" />
        </div>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
          Cada <b>5 episodios completados</b> (mín. 20 min vistos por episodio) ganas 1 ficha Z. Cada tirada del gachapón cuesta <b>2 fichas</b>.
        </p>
      </div>

      <div className="flex gap-2">
        {(["frame","banner"] as const).map((p) => (
          <button key={p} onClick={() => { setPool(p); setResult(null); setPhase("idle"); }}
            className={cn("flex-1 h-10 rounded-lg text-sm font-medium border transition",
              pool === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            {p === "frame" ? "Marcos" : "Banners"}
          </button>
        ))}
      </div>

      {/* Cápsula gachapón */}
      <div className="relative aspect-square max-w-[260px] mx-auto flex items-center justify-center">
        {/* Rayos de fondo cuando hay premio */}
        {phase === "reveal" && result && (
          <div className="zf-gacha-rays" style={{ ["--zf-ray" as any]: `${meta.color}55` }} />
        )}

        {/* Flash central al abrir */}
        {phase === "burst" && (
          <div className="zf-gacha-flash" style={{ color: meta.color }} />
        )}

        <div
          className={cn(
            "w-44 h-44 rounded-full border-4 flex items-center justify-center relative overflow-hidden transition-all",
            phase === "shake" && "zf-gacha-shake",
            phase === "reveal" && "zf-prize-halo"
          )}
          style={{
            borderColor: phase === "reveal" ? meta.color : "hsl(var(--primary) / 0.4)",
            filter: phase === "reveal" ? `drop-shadow(${meta.glow})` : undefined,
            ["--zf-halo" as any]: meta.color,
            // Fondo: banner ganado ocupa la cápsula, o base
            background: phase === "reveal" && result && result.pool === "banner" && result.image_url
              ? `url("${result.image_url}") center/cover no-repeat`
              : phase === "reveal" && result?.special
              ? `radial-gradient(circle, ${meta.color}33 0%, transparent 70%)`
              : undefined,
          }}
        >
          {/* Z original (visible antes del reveal) */}
          {phase !== "reveal" && (
            <span
              className={cn(
                "text-7xl font-black text-primary/50 relative z-10",
                phase === "burst" && "zf-z-burst"
              )}
              style={phase === "burst" ? { color: meta.color } : undefined}
            >
              Z
            </span>
          )}

          {/* Reveal del premio */}
          {phase === "reveal" && result && (
            <div className="text-center px-2 zf-gacha-reveal relative z-10 w-full h-full flex flex-col items-center justify-center">
              {result.pool === "name" ? (
                // Título secreto — recompensa especial
                <div className="flex flex-col items-center gap-2">
                  <Sparkles className="w-10 h-10 animate-pulse" style={{ color: meta.color }} />
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>
                    ¡Especial!
                  </p>
                  <p className="text-2xl font-black" style={{ color: meta.color, textShadow: `0 0 12px ${meta.color}` }}>
                    {result.name}
                  </p>
                  <p className="text-[10px] text-white/80">Nuevo título</p>
                </div>
              ) : result.pool === "frame" && result.image_url ? (
                <img
                  src={result.image_url}
                  alt=""
                  className="w-40 h-40 object-contain drop-shadow-2xl"
                  style={{ filter: `drop-shadow(0 0 12px ${meta.color})` }}
                />
              ) : result.pool === "banner" ? (
                <div className="absolute inset-x-0 bottom-2 bg-black/60 backdrop-blur-sm py-1.5 px-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>{meta.label}</p>
                  <p className="text-xs text-white truncate">{result.name}</p>
                </div>
              ) : (
                <Sparkles className="w-16 h-16 mx-auto text-primary" />
              )}
            </div>
          )}
        </div>

        {/* Label bajo la cápsula para marcos y títulos */}
        {phase === "reveal" && result && (result.pool === "frame" || result.pool === "name") && (
          <div className="absolute -bottom-2 left-0 right-0 text-center">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: meta.color }}>
              {result.special ? "🎉 Recompensa especial" : meta.label}
            </p>
            {result.pool === "frame" && <p className="text-sm text-foreground/90 font-medium">{result.name}</p>}
          </div>
        )}
      </div>

      <button
        onClick={doPull}
        disabled={pulling || tokens.tokens < 2}
        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition mt-6"
      >
        {pulling ? <><Loader2 className="w-4 h-4 animate-spin" /> Abriendo cápsula…</> : <><Sparkles className="w-4 h-4" /> Tirar (2 fichas)</>}
      </button>

      {phase === "reveal" && (
        <button onClick={() => { setResult(null); setPhase("idle"); }} className="w-full h-9 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
          <X className="w-3.5 h-3.5" /> Cerrar resultado
        </button>
      )}

      {/* Tabla de probabilidades */}
      <div className="rounded-xl border border-border p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Package className="w-3.5 h-3.5" /> Probabilidades
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(RARITY_META) as Rarity[]).map((r) => {
            const m = RARITY_META[r];
            return (
              <div key={r} className="flex items-center justify-between text-xs">
                <span className="rarity-chip" style={{ color: m.color }}>{m.label}</span>
                <span className="text-muted-foreground">{(m.chance * 100).toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
