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
import { useProfiles } from "@/contexts/ProfilesContext";
import { updateProfile } from "@/lib/account-profiles";
import { usePreferences } from "@/contexts/PreferencesContext";

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
  const { activeProfile, refresh: refreshProfiles } = useProfiles();
  const { preferences, setPreference, resetPreferences } = usePreferences();
  const { autoPlay, countdown, dataSaver, hideGore, reducedMotion, keepScreenOn } = preferences;
  const setAutoPlay = (v: boolean) => setPreference("autoPlay", v);
  const setCountdown = (v: boolean) => setPreference("countdown", v);
  const setDataSaver = (v: boolean) => setPreference("dataSaver", v);
  const setHideGore = (v: boolean) => setPreference("hideGore", v);
  const setReducedMotion = (v: boolean) => setPreference("reducedMotion", v);
  const setKeepScreenOn = (v: boolean) => setPreference("keepScreenOn", v);
  const [selectedAccent, setSelectedAccent] = useState<AccentColor>(getAccentColor);
  const [selectedFont, setSelectedFont] = useState(() => localStorage.getItem("zet_font") || "default");

  // Edit name
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setDisplayName(activeProfile?.name || profile?.display_name || profile?.username || "");
    setSelectedFont(activeProfile?.font_family || localStorage.getItem("zet_font") || "default");
  }, [profile, activeProfile]);

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

  const handleFontChange = async (id: string) => {
    setSelectedFont(id);
    localStorage.setItem("zet_font", id);
    applyFont(id);
    if (activeProfile) {
      await updateProfile(activeProfile.id, { font_family: id === "default" ? null : id });
      await refreshProfiles();
    }
  };

  const handleSave = () => {
    // Las preferencias globales ya se persisten automáticamente al cambiar el switch.
    // Este botón queda como confirmación explícita para el usuario.
    toast.success("Configuración guardada");
  };

  const handleSaveName = async () => {
    if (!user) return;
    const trimmed = displayName.trim();
    if (!trimmed) return toast.error("El nombre no puede estar vacío");
    if (trimmed.length > 30) return toast.error("Máximo 30 caracteres");
    setSavingName(true);
    if (activeProfile) {
      await updateProfile(activeProfile.id, { name: trimmed.slice(0, 20) });
      await refreshProfiles();
      setSavingName(false);
      toast.success("Nombre actualizado");
      return;
    }
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
      <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/70 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link to="/profile" className="w-9 h-9 rounded-full zet-btn-ghost flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <h1 className="heading-steam text-lg md:text-xl font-semibold text-foreground tracking-wide">Configuración</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-8 space-y-8">
        {/* Profile name */}
        {user && (
          <section className="zet-panel p-5 md:p-6">
            <h2 className="heading-steam text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="zet-icon-badge w-7 h-7"><User className="w-3.5 h-3.5" /></span>
              Tu Perfil
            </h2>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block mb-2">
              Nombre que se muestra
            </label>
            <div className="flex gap-2">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Tu nombre"
                maxLength={30}
                className="bg-background/60 border-border/80 font-serif-body text-base"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || displayName === (profile?.display_name || "")}
                className="px-5 rounded-lg zet-btn-primary text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 italic">@{profile?.username}</p>
          </section>
        )}

        {/* Playback + Network merged in a two-column grid on md+ */}
        <div className="grid md:grid-cols-2 gap-4">
          <section className="zet-panel p-5">
            <h2 className="heading-steam text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">▶ Reproducción</h2>
            <div className="space-y-2">
              {[
                { label: "Reproducir siguiente automáticamente", sub: "Al llegar al 85%, salta al siguiente episodio", val: autoPlay, set: setAutoPlay },
                { label: "Mostrar cuenta regresiva", sub: "Temporizador antes del siguiente episodio", val: countdown, set: setCountdown },
                { label: "Mantener pantalla activa", sub: "Evita que la pantalla se apague durante la reproducción", val: keepScreenOn, set: setKeepScreenOn },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between zet-panel-soft px-4 py-3">
                  <div className="flex-1 pr-3">
                    <p className="text-sm text-foreground font-serif-body">{row.label}</p>
                    <p className="text-[10px] text-muted-foreground italic">{row.sub}</p>
                  </div>
                  <Switch checked={row.val} onCheckedChange={row.set} />
                </div>
              ))}
            </div>
          </section>

          <section className="zet-panel p-5">
            <h2 className="heading-steam text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">📡 Red y Contenido</h2>
            <div className="space-y-2">
              {[
                { label: "Modo Ahorro de Datos", sub: "Carga imágenes en menor calidad", val: dataSaver, set: setDataSaver },
                { label: "Ocultar contenido Gore", sub: "Filtra anime con violencia extrema del directorio", val: hideGore, set: setHideGore },
                { label: "Reducir animaciones", sub: "Mejora rendimiento en equipos lentos", val: reducedMotion, set: setReducedMotion },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between zet-panel-soft px-4 py-3">
                  <div className="flex-1 pr-3">
                    <p className="text-sm text-foreground font-serif-body">{row.label}</p>
                    <p className="text-[10px] text-muted-foreground italic">{row.sub}</p>
                  </div>
                  <Switch checked={row.val} onCheckedChange={row.set} />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Font picker */}
        <section className="zet-panel p-5 md:p-6">
          <h2 className="heading-steam text-sm font-semibold text-foreground mb-1 uppercase tracking-wider">🔤 Tipografía</h2>
          <p className="text-[11px] text-muted-foreground italic mb-4">
            Solo se guarda en este dispositivo. La fuente se carga al activarse.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {FONT_OPTIONS.map((f) => {
              const isSelected = selectedFont === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => handleFontChange(f.id)}
                  className={`px-3 py-3 rounded-xl text-xs font-medium transition-all text-left border ${
                    isSelected
                      ? "zet-btn-primary border-transparent"
                      : "zet-btn-ghost"
                  }`}
                  style={f.id !== "default" ? { fontFamily: f.css } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span>{f.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <p className="text-[10px] mt-0.5 opacity-80">Aa Bb Cc 123</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Accent color */}
        <section className="zet-panel p-5 md:p-6">
          <h2 className="heading-steam text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">🎨 Color de Acento</h2>

          <div className="zet-panel-soft p-4 mb-3">
            <p className="text-[10px] text-muted-foreground mb-3 font-bold uppercase tracking-wider">Gratis</p>
            <div className="flex justify-around flex-wrap gap-3">
              {ACCENT_COLORS.filter((c) => !c.premium).map((c) => {
                const isSelected = selectedAccent.name === c.name;
                return (
                  <button key={c.name} onClick={() => handleAccentChange(c)} className="flex flex-col items-center gap-2 group">
                    <div
                      className={`w-11 h-11 rounded-full transition-all duration-300 flex items-center justify-center ${
                        isSelected ? "ring-2 ring-offset-2 ring-offset-background scale-110" : "hover:scale-105"
                      }`}
                      style={{
                        background: `radial-gradient(circle at 30% 30%, ${c.hex}, ${c.hex}cc 70%)`,
                        boxShadow: isSelected ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${c.hex}, 0 0 22px ${c.hex}88` : `0 4px 12px -4px ${c.hex}66`,
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

          <div className="rounded-xl p-4 border border-primary/40 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Premium · Exclusivos</p>
              {!isPremium && <span className="ml-auto text-[9px] text-muted-foreground italic">Solo miembros</span>}
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
              {ACCENT_COLORS.filter((c) => c.premium).map((c) => {
                const isSelected = selectedAccent.name === c.name;
                const locked = !isPremium;
                return (
                  <button key={c.name} onClick={() => handleAccentChange(c)} className="flex flex-col items-center gap-1.5 group" title={locked ? "Premium requerido" : c.name}>
                    <div
                      className={`relative w-11 h-11 rounded-full transition-all duration-300 flex items-center justify-center ${
                        isSelected ? "ring-2 ring-offset-2 ring-offset-background scale-110" : locked ? "opacity-50 grayscale-[40%]" : "hover:scale-105"
                      }`}
                      style={{
                        background: `radial-gradient(circle at 30% 30%, ${c.hex}, ${c.hex}cc 70%)`,
                        boxShadow: isSelected ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${c.hex}, 0 0 22px ${c.hex}88` : undefined,
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
              <Link to="/profile?premium=1" className="mt-3 block w-full text-center text-[11px] font-bold text-primary hover:underline">
                🔓 Desbloquear paleta premium →
              </Link>
            )}
          </div>
        </section>

        {/* Save / reset */}
        <div className="flex flex-col md:flex-row gap-3">
          <button
            onClick={handleSave}
            className="flex-1 py-4 rounded-xl zet-btn-primary heading-steam text-sm font-semibold tracking-widest uppercase hover:scale-[1.01] active:scale-[0.99]"
          >
            Guardar Cambios
          </button>
          <button
            onClick={handleResetDefaults}
            className="md:w-72 py-3 rounded-xl zet-btn-ghost text-xs font-bold uppercase tracking-wider"
          >
            Restaurar predeterminados
          </button>
        </div>

        <AdBanner300x250 />
      </div>
    </div>
  );
}
