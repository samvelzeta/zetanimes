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
  const [pulling, setPulling] = useState(false);
  const [result, setResult] = useState<PullResult | null>(null);

  const doPull = async () => {
    if (tokens.tokens < 1) { toast.error("No tienes fichas Z. Mira más animes para ganar."); return; }
    setPulling(true);
    setResult(null);
    try {
      // Pequeña pausa dramática
      await new Promise((r) => setTimeout(r, 900));
      const res = await pull(pool);
      if (!res.ok) {
        toast.error(res.reason === "no_tokens" ? "Sin fichas" : res.reason === "all_owned" ? "¡Ya tienes todo!" : "No se pudo tirar");
      } else {
        setResult(res);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "error");
    } finally {
      setPulling(false);
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
          Cada <b>10 episodios completados</b> ganas 1 ficha Z. Gástalas en el gachapón para conseguir marcos y banners aleatorios.
        </p>
      </div>

      <div className="flex gap-2">
        {(["frame","banner"] as const).map((p) => (
          <button key={p} onClick={() => { setPool(p); setResult(null); }}
            className={cn("flex-1 h-10 rounded-lg text-sm font-medium border transition",
              pool === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
            {p === "frame" ? "Marcos" : "Banners"}
          </button>
        ))}
      </div>

      {/* Cápsula gachapón */}
      <div className="relative aspect-square max-w-[220px] mx-auto flex items-center justify-center">
        <div className={cn(
          "w-40 h-40 rounded-full border-4 flex items-center justify-center relative overflow-hidden transition-all",
          pulling ? "zf-gacha-shake" : "",
          result ? `zf-rarity-${rarity}` : "border-primary/40"
        )} style={result ? { borderColor: meta.color, filter: `drop-shadow(${meta.glow})` } : {}}>
          {result ? (
            <div className="text-center px-2 zf-gacha-reveal">
              {result.image_url ? (
                <img src={result.image_url} alt="" className="w-20 h-20 mx-auto rounded-full object-cover" />
              ) : (
                <Sparkles className="w-14 h-14 mx-auto text-primary" />
              )}
              <p className="mt-2 text-sm font-bold" style={{ color: meta.color }}>{meta.label}</p>
              <p className="text-xs text-foreground/80 truncate">{result.name}</p>
            </div>
          ) : (
            <span className="text-6xl font-black text-primary/40">Z</span>
          )}
        </div>
      </div>

      <button
        onClick={doPull}
        disabled={pulling || tokens.tokens < 1}
        className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition"
      >
        {pulling ? <><Loader2 className="w-4 h-4 animate-spin" /> Tirando…</> : <><Sparkles className="w-4 h-4" /> Tirar (1 ficha)</>}
      </button>

      {result && (
        <button onClick={() => setResult(null)} className="w-full h-9 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
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
