import { useState, useEffect } from "react";
import { ArrowLeft, Check, User, Loader2, Lock, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ACCENT_COLORS, getAccentColor, setAccentColor, type AccentColor } from "@/lib/accent";
import { toast } from "sonner";
import AdBanner300x250 from "@/components/ads/AdBanner300x250";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const FONT_OPTIONS = [
  { id: "default", name: "Predeterminada", css: "" },
  { id: "inter", name: "Inter (limpia)", css: "'Inter', system-ui, sans-serif" },
  { id: "poppins", name: "Poppins (moderna)", css: "'Poppins', sans-serif" },
  { id: "rubik", name: "Rubik (geométrica)", css: "'Rubik', sans-serif" },
  { id: "nunito", name: "Nunito (suave)", css: "'Nunito', sans-serif" },
  { id: "roboto-mono", name: "Roboto Mono", css: "'Roboto Mono', monospace" },
];

function applyFont(id: string) {
  const opt = FONT_OPTIONS.find((f) => f.id === id) || FONT_OPTIONS[0];
  if (opt.id === "default" || !opt.css) {
    document.body.style.removeProperty("font-family");
  } else {
    // Cargar Google Font on-demand una sola vez
    const linkId = `google-font-${opt.id}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      const family = opt.css.split(",")[0].replace(/['"]/g, "").trim().replace(/\s+/g, "+");
      link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;600;700;900&display=swap`;
      document.head.appendChild(link);
    }
    document.body.style.fontFamily = opt.css;
  }
}

export function initFont() {
  const id = localStorage.getItem("zet_font") || "default";
  applyFont(id);
}

export default function SettingsPage() {
  const { user, profile, refreshProfile, isPremium } = useAuth();
  const [selectedAccent, setSelectedAccent] = useState<AccentColor>(getAccentColor);
  const [autoPlay, setAutoPlay] = useState(() => localStorage.getItem("zet_autoplay") !== "false");
  const [countdown, setCountdown] = useState(() => localStorage.getItem("zet_countdown") === "true");
  const [dataSaver, setDataSaver] = useState(() => localStorage.getItem("zet_datasaver") === "true");
  const [hideGore, setHideGore] = useState(() => localStorage.getItem("zet_hidegore") === "true");
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem("zet_reduced_motion") === "true");
  const [keepScreenOn, setKeepScreenOn] = useState(() => localStorage.getItem("zet_keep_awake") === "true");
  const [selectedFont, setSelectedFont] = useState(() => localStorage.getItem("zet_font") || "default");

  // Edit name
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name || profile?.username || "");
  }, [profile]);

  const handleAccentChange = (color: AccentColor) => {
    if (color.premium && !isPremium) {
      toast.error("Color exclusivo Premium", {
        description: "Hazte Premium para desbloquear esta paleta",
      });
      return;
    }
    setSelectedAccent(color);
    setAccentColor(color);
  };

  const handleFontChange = (id: string) => {
    setSelectedFont(id);
    localStorage.setItem("zet_font", id);
    applyFont(id);
  };

  const handleSave = () => {
    localStorage.setItem("zet_autoplay", String(autoPlay));
    localStorage.setItem("zet_countdown", String(countdown));
    localStorage.setItem("zet_datasaver", String(dataSaver));
    localStorage.setItem("zet_hidegore", String(hideGore));
    localStorage.setItem("zet_reduced_motion", String(reducedMotion));
    localStorage.setItem("zet_keep_awake", String(keepScreenOn));

    // Aplicar reduced motion
    if (reducedMotion) {
      document.documentElement.classList.add("zet-reduced-motion");
    } else {
      document.documentElement.classList.remove("zet-reduced-motion");
    }

    toast.success("Configuración guardada");
  };

  const handleSaveName = async () => {
    if (!user) return;
    const trimmed = displayName.trim();
    if (!trimmed) return toast.error("El nombre no puede estar vacío");
    if (trimmed.length > 30) return toast.error("Máximo 30 caracteres");
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("user_id", user.id);
    setSavingName(false);
    if (error) return toast.error("Error al guardar");
    await refreshProfile();
    toast.success("Nombre actualizado");
  };

  const handleResetDefaults = () => {
    handleAccentChange(ACCENT_COLORS[0]);
    handleFontChange("default");
    setAutoPlay(true);
    setCountdown(false);
    setDataSaver(false);
    setHideGore(false);
    setReducedMotion(false);
    setKeepScreenOn(false);
    localStorage.removeItem("zet_autoplay");
    localStorage.removeItem("zet_countdown");
    localStorage.removeItem("zet_datasaver");
    localStorage.removeItem("zet_hidegore");
    localStorage.removeItem("zet_reduced_motion");
    localStorage.removeItem("zet_keep_awake");
    document.documentElement.classList.remove("zet-reduced-motion");
    toast.success("Restablecido a valores predeterminados");
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/profile" className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-primary/20 transition">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <h1 className="text-base font-black text-foreground">Configuración</h1>
      </div>

      <div className="px-4 pt-6 space-y-6">
        {/* Profile name */}
        {user && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Tu Perfil
            </h2>
            <div className="bg-secondary rounded-xl p-4 space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground font-medium block mb-1.5">
                  Nombre que se muestra
                </label>
                <div className="flex gap-2">
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Tu nombre"
                    maxLength={30}
                    className="bg-background"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName || displayName === (profile?.display_name || "")}
                    className="px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">@{profile?.username}</p>
              </div>
            </div>
          </div>
        )}

        {/* Playback */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">▶ Reproducción</h2>
          <div className="space-y-1">
            <div className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
              <div className="flex-1 pr-3">
                <p className="text-sm text-foreground">Reproducir siguiente automáticamente</p>
                <p className="text-[10px] text-muted-foreground">Al llegar al 85%, salta al siguiente episodio</p>
              </div>
              <Switch checked={autoPlay} onCheckedChange={setAutoPlay} />
            </div>
            <div className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
              <div className="flex-1 pr-3">
                <p className="text-sm text-foreground">Mostrar cuenta regresiva</p>
                <p className="text-[10px] text-muted-foreground">Temporizador antes del siguiente episodio</p>
              </div>
              <Switch checked={countdown} onCheckedChange={setCountdown} />
            </div>
            <div className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
              <div className="flex-1 pr-3">
                <p className="text-sm text-foreground">Mantener pantalla activa</p>
                <p className="text-[10px] text-muted-foreground">Evita que la pantalla se apague durante la reproducción</p>
              </div>
              <Switch checked={keepScreenOn} onCheckedChange={setKeepScreenOn} />
            </div>
          </div>
        </div>

        {/* Network & content */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">📡 Red y Contenido</h2>
          <div className="space-y-1">
            <div className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
              <div className="flex-1 pr-3">
                <p className="text-sm text-foreground">Modo Ahorro de Datos</p>
                <p className="text-[10px] text-muted-foreground">Carga imágenes en menor calidad</p>
              </div>
              <Switch checked={dataSaver} onCheckedChange={setDataSaver} />
            </div>
            <div className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
              <div className="flex-1 pr-3">
                <p className="text-sm text-foreground">Ocultar contenido Gore</p>
                <p className="text-[10px] text-muted-foreground">Filtra anime con violencia extrema del directorio</p>
              </div>
              <Switch checked={hideGore} onCheckedChange={setHideGore} />
            </div>
            <div className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
              <div className="flex-1 pr-3">
                <p className="text-sm text-foreground">Reducir animaciones</p>
                <p className="text-[10px] text-muted-foreground">Mejora rendimiento en equipos lentos</p>
              </div>
              <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
            </div>
          </div>
        </div>

        {/* Font picker (only stores ID, no DB) */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">🔤 Tipografía</h2>
          <p className="text-[10px] text-muted-foreground mb-2">
            Solo se guarda en este dispositivo. La fuente se carga al activarse.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {FONT_OPTIONS.map((f) => {
              const isSelected = selectedFont === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => handleFontChange(f.id)}
                  className={`px-3 py-3 rounded-xl text-xs font-medium transition-all text-left ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-muted"
                  }`}
                  style={f.id !== "default" ? { fontFamily: f.css } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span>{f.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <p className="text-[9px] mt-0.5 opacity-70">Aa Bb Cc 123</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent color */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">🎨 Color de Acento</h2>

          {/* Free palette */}
          <div className="bg-secondary rounded-xl p-4 mb-2">
            <p className="text-[10px] text-muted-foreground mb-3 font-bold uppercase tracking-wider">Gratis</p>
            <div className="flex justify-around flex-wrap gap-3">
              {ACCENT_COLORS.filter((c) => !c.premium).map((c) => {
                const isSelected = selectedAccent.name === c.name;
                return (
                  <button
                    key={c.name}
                    onClick={() => handleAccentChange(c)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div
                      className={`w-11 h-11 rounded-full transition-all duration-300 flex items-center justify-center ${
                        isSelected ? "ring-2 ring-offset-2 ring-offset-background scale-110" : "hover:scale-105"
                      }`}
                      style={{
                        backgroundColor: c.hex,
                        boxShadow: isSelected ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${c.hex}` : undefined,
                      }}
                    >
                      {isSelected && <Check className="w-5 h-5 text-white drop-shadow-md" />}
                    </div>
                    <span className={`text-[10px] font-medium transition-colors ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Premium palette */}
          <div className="rounded-xl p-4 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Premium · Exclusivos</p>
              {!isPremium && <span className="ml-auto text-[9px] text-muted-foreground">Solo miembros</span>}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {ACCENT_COLORS.filter((c) => c.premium).map((c) => {
                const isSelected = selectedAccent.name === c.name;
                const locked = !isPremium;
                return (
                  <button
                    key={c.name}
                    onClick={() => handleAccentChange(c)}
                    className="flex flex-col items-center gap-1.5 group"
                    title={locked ? "Premium requerido" : c.name}
                  >
                    <div
                      className={`relative w-11 h-11 rounded-full transition-all duration-300 flex items-center justify-center ${
                        isSelected ? "ring-2 ring-offset-2 ring-offset-background scale-110" : locked ? "opacity-50 grayscale-[40%]" : "hover:scale-105"
                      }`}
                      style={{
                        backgroundColor: c.hex,
                        boxShadow: isSelected ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${c.hex}` : undefined,
                      }}
                    >
                      {isSelected && <Check className="w-5 h-5 text-white drop-shadow-md" />}
                      {locked && !isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                          <Lock className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <span className={`text-[9px] font-medium transition-colors text-center leading-tight ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
            {!isPremium && (
              <Link
                to="/profile?premium=1"
                className="mt-3 block w-full text-center text-[11px] font-bold text-primary hover:underline"
              >
                🔓 Desbloquear paleta premium →
              </Link>
            )}
          </div>
        </div>

        {/* Save / reset */}
        <div className="space-y-2">
          <button
            onClick={handleSave}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Guardar Cambios
          </button>
          <button
            onClick={handleResetDefaults}
            className="w-full py-3 rounded-xl bg-secondary text-muted-foreground font-bold text-xs hover:bg-muted transition-all"
          >
            Restaurar valores predeterminados
          </button>
        </div>

        {/* Ad – usuarios free */}
        <AdBanner300x250 />
      </div>
    </div>
  );
}
