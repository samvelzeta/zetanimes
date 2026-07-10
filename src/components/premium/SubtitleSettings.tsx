import { X, RotateCcw, Lock } from "lucide-react";
import { DEFAULT_SUB_PREFS, type SubtitlePrefs } from "@/hooks/useSubtitlePrefs";

interface Props {
  prefs: SubtitlePrefs;
  update: (patch: Partial<SubtitlePrefs>) => void;
  reset: () => void;
  onClose: () => void;
  isPremium: boolean;
}

const COLORS = ["#ffffff", "#ffe600", "#ff6a00", "#ff2d55", "#3fe1ff", "#7cff5c", "#c084fc", "#000000"];

export default function SubtitleSettings({ prefs, update, reset, onClose, isPremium }: Props) {
  const PremiumGate = ({ children }: { children: React.ReactNode }) => (
    <div className={`relative ${isPremium ? "" : "opacity-60 pointer-events-none select-none"}`}>
      {children}
      {!isPremium && (
        <div className="absolute -top-1 -right-1 bg-primary/90 rounded-full p-0.5">
          <Lock className="w-2.5 h-2.5 text-primary-foreground" />
        </div>
      )}
    </div>
  );

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-full right-0 mb-2 w-[280px] rounded-xl border border-white/10 bg-black/85 backdrop-blur-xl p-3 shadow-2xl z-40"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-white/50">Subtítulos</p>
        <div className="flex items-center gap-1">
          <button onClick={reset} className="text-white/50 hover:text-white transition p-1" title="Restablecer">
            <RotateCcw className="w-3 h-3" />
          </button>
          <button onClick={onClose} className="text-white/50 hover:text-white transition p-1">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Tamaño (todos) */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-white/60">Tamaño</label>
          <span className="text-[10px] font-mono tabular-nums text-primary">{prefs.size}%</span>
        </div>
        <input
          type="range" min={60} max={200} step={10}
          value={prefs.size}
          onChange={(e) => update({ size: Number(e.target.value) })}
          className="w-full h-1 accent-primary"
        />
      </div>

      {/* Color (premium) */}
      <PremiumGate>
        <div className="mb-3">
          <label className="text-[10px] text-white/60 mb-1 block">Color</label>
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => update({ color: c })}
                className={`w-6 h-6 rounded-full border transition ${
                  prefs.color === c ? "border-primary scale-110 shadow-[0_0_8px_hsl(var(--primary))]" : "border-white/20"
                }`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      </PremiumGate>

      {/* Fondo (premium) */}
      <PremiumGate>
        <div className="mb-3">
          <label className="text-[10px] text-white/60 mb-1 block">Fondo</label>
          <div className="grid grid-cols-3 gap-1">
            {(["none", "semi", "black"] as const).map((b) => (
              <button
                key={b}
                onClick={() => update({ bg: b })}
                className={`px-2 py-1.5 rounded text-[10px] transition ${
                  prefs.bg === b ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {b === "none" ? "Sin fondo" : b === "semi" ? "Semi" : "Negro"}
              </button>
            ))}
          </div>
        </div>
      </PremiumGate>

      {/* Fuente (premium) */}
      <PremiumGate>
        <div className="mb-3">
          <label className="text-[10px] text-white/60 mb-1 block">Fuente</label>
          <div className="grid grid-cols-4 gap-1">
            {(["sans", "serif", "mono", "anime"] as const).map((f) => (
              <button
                key={f}
                onClick={() => update({ font: f })}
                className={`px-1.5 py-1.5 rounded text-[10px] transition ${
                  prefs.font === f ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {f === "sans" ? "Aa" : f === "serif" ? "Aa" : f === "mono" ? "Aa" : "亜A"}
              </button>
            ))}
          </div>
        </div>
      </PremiumGate>

      {/* Posición (premium) */}
      <PremiumGate>
        <div className="mb-1">
          <label className="text-[10px] text-white/60 mb-1 block">Posición</label>
          <div className="grid grid-cols-3 gap-1">
            {(["low", "mid", "high"] as const).map((p) => (
              <button
                key={p}
                onClick={() => update({ position: p })}
                className={`px-2 py-1.5 rounded text-[10px] transition ${
                  prefs.position === p ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {p === "low" ? "Abajo" : p === "mid" ? "Medio" : "Arriba"}
              </button>
            ))}
          </div>
        </div>
      </PremiumGate>

      {!isPremium && (
        <p className="mt-3 text-[9px] text-white/40 text-center leading-tight">
          Personalización avanzada disponible para Premium.
        </p>
      )}
    </div>
  );
}
