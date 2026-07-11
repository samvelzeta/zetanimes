import { X, RotateCcw, Lock } from "lucide-react";
import { DEFAULT_SUB_PREFS, type SubtitlePrefs, type SubFont } from "@/hooks/useSubtitlePrefs";

interface Props {
  prefs: SubtitlePrefs;
  update: (patch: Partial<SubtitlePrefs>) => void;
  reset: () => void;
  onClose: () => void;
  isPremium: boolean;
}

// Colores: blanco y amarillo son gratis; el resto Usuario Z.
const FREE_COLORS = ["#ffffff", "#ffe600"];
const PREMIUM_COLORS = ["#ff6a00", "#ff2d55", "#3fe1ff", "#7cff5c", "#c084fc", "#000000"];

// Fuentes: 2 gratis, resto Usuario Z.
const FREE_FONTS: { id: SubFont; label: string; sample: string; style: React.CSSProperties }[] = [
  { id: "serif",   label: "Serif",   sample: "Aa", style: { fontFamily: "'EB Garamond', serif" } },
  { id: "cursive", label: "Cursiva", sample: "Aa", style: { fontFamily: "'Dancing Script', cursive", fontWeight: 700 } },
];
const PREMIUM_FONTS: { id: SubFont; label: string; sample: string; style: React.CSSProperties }[] = [
  { id: "sans",   label: "Sans",   sample: "Aa", style: { fontFamily: "'Inter', system-ui, sans-serif" } },
  { id: "hand",   label: "Mano",   sample: "Aa", style: { fontFamily: "'Caveat', cursive", fontWeight: 700 } },
  { id: "gothic", label: "Gótica", sample: "Aa", style: { fontFamily: "'MedievalSharp', serif" } },
  { id: "bold",   label: "Gruesa", sample: "Aa", style: { fontFamily: "'Anton', Impact, sans-serif" } },
];

const ORANGE = "hsl(24 95% 58%)";

function ZBadge() {
  return (
    <span
      className="ml-1 px-1 py-[1px] rounded-sm text-[8px] font-mono uppercase tracking-widest"
      style={{ background: `${ORANGE}22`, color: ORANGE, border: `1px solid ${ORANGE}55` }}
    >
      Z
    </span>
  );
}

function SectionHeader({ label, premium }: { label: string; premium?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-1">
      <label className="text-[10px] text-white/60">{label}</label>
      {premium && (
        <span
          className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest"
          style={{ color: ORANGE }}
        >
          <Lock className="w-2.5 h-2.5" /> Usuario Z
        </span>
      )}
    </div>
  );
}

export default function SubtitleSettings({ prefs, update, reset, onClose, isPremium }: Props) {
  const lockedCls = "opacity-40 cursor-not-allowed";

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-full right-0 mb-2 w-[300px] max-h-[70vh] overflow-y-auto rounded-xl border border-white/10 bg-black/85 backdrop-blur-xl p-3 shadow-2xl z-40"
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

      {/* Tamaño — Usuario Z */}
      <div className="mb-3">
        <SectionHeader label="Tamaño" premium />
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-white/40">{isPremium ? "Ajusta libremente" : "Bloqueado"}</span>
          <span className="text-[10px] font-mono tabular-nums" style={{ color: isPremium ? "hsl(var(--primary))" : ORANGE }}>
            {prefs.size}%
          </span>
        </div>
        <input
          type="range" min={60} max={200} step={10}
          value={prefs.size}
          disabled={!isPremium}
          onChange={(e) => isPremium && update({ size: Number(e.target.value) })}
          className={`w-full h-1 accent-primary ${!isPremium ? "cursor-not-allowed opacity-50" : ""}`}
        />
      </div>

      {/* Color */}
      <div className="mb-3">
        <label className="text-[10px] text-white/60 mb-1 block">Color</label>
        <div className="flex flex-wrap gap-1.5">
          {FREE_COLORS.map((c) => (
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
          {PREMIUM_COLORS.map((c) => {
            const locked = !isPremium;
            return (
              <button
                key={c}
                onClick={() => !locked && update({ color: c })}
                disabled={locked}
                title={locked ? "Usuario Z" : c}
                className={`relative w-6 h-6 rounded-full border transition ${
                  prefs.color === c ? "border-primary scale-110 shadow-[0_0_8px_hsl(var(--primary))]" : "border-white/20"
                } ${locked ? lockedCls : ""}`}
                style={{ background: c }}
                aria-label={c}
              >
                {locked && (
                  <Lock
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full p-[1px]"
                    style={{ background: ORANGE, color: "#fff" }}
                  />
                )}
              </button>
            );
          })}
        </div>
        {!isPremium && (
          <p className="text-[9px] mt-1" style={{ color: ORANGE }}>
            Solo blanco y amarillo. El resto es Usuario Z.
          </p>
        )}
      </div>

      {/* Fondo — Usuario Z */}
      <div className="mb-3">
        <SectionHeader label="Fondo" premium />
        <div className={`grid grid-cols-3 gap-1 ${!isPremium ? lockedCls : ""}`}>
          {(["none", "semi", "black"] as const).map((b) => (
            <button
              key={b}
              disabled={!isPremium}
              onClick={() => isPremium && update({ bg: b })}
              className={`px-2 py-1.5 rounded text-[10px] transition ${
                prefs.bg === b ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {b === "none" ? "Sin fondo" : b === "semi" ? "Semi" : "Negro"}
            </button>
          ))}
        </div>
      </div>

      {/* Fuente */}
      <div className="mb-3">
        <label className="text-[10px] text-white/60 mb-1 block">Fuente</label>
        <div className="grid grid-cols-3 gap-1">
          {FREE_FONTS.map((f) => (
            <button
              key={f.id}
              onClick={() => update({ font: f.id })}
              className={`px-1.5 py-1.5 rounded text-[11px] transition ${
                prefs.font === f.id ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
              style={f.style}
              title={f.label}
            >
              {f.sample}
            </button>
          ))}
          {PREMIUM_FONTS.map((f) => {
            const locked = !isPremium;
            return (
              <button
                key={f.id}
                disabled={locked}
                onClick={() => !locked && update({ font: f.id })}
                title={locked ? `${f.label} — Usuario Z` : f.label}
                className={`relative px-1.5 py-1.5 rounded text-[11px] transition ${
                  prefs.font === f.id ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/70 hover:bg-white/10"
                } ${locked ? lockedCls : ""}`}
                style={f.style}
              >
                {f.sample}
                {locked && (
                  <Lock
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full p-[1px]"
                    style={{ background: ORANGE, color: "#fff" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Posición — libre */}
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

      {!isPremium && (
        <p className="mt-3 text-[9px] text-white/40 text-center leading-tight">
          Tamaño, fondo, fuentes especiales y colores extra disponibles para Usuario Z.
        </p>
      )}

      {/* Referencia para evitar tree-shaking del default (por si se usa fuera) */}
      <span className="hidden">{DEFAULT_SUB_PREFS.size}</span>
    </div>
  );
}
