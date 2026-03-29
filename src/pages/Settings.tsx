import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { ACCENT_COLORS, getAccentColor, setAccentColor, type AccentColor } from "@/lib/accent";
import { toast } from "sonner";

export default function SettingsPage() {
  const [selectedAccent, setSelectedAccent] = useState<AccentColor>(getAccentColor);
  const [autoPlay, setAutoPlay] = useState(() => localStorage.getItem("zet_autoplay") !== "false");
  const [countdown, setCountdown] = useState(() => localStorage.getItem("zet_countdown") === "true");
  const [dataSaver, setDataSaver] = useState(() => localStorage.getItem("zet_datasaver") === "true");
  const [hideGore, setHideGore] = useState(() => localStorage.getItem("zet_hidegore") === "true");
  const [preferredLang, setPreferredLang] = useState(() => localStorage.getItem("zet_lang") || "sub");

  const handleAccentChange = (color: AccentColor) => {
    setSelectedAccent(color);
    setAccentColor(color);
  };

  const handleSave = () => {
    localStorage.setItem("zet_autoplay", String(autoPlay));
    localStorage.setItem("zet_countdown", String(countdown));
    localStorage.setItem("zet_datasaver", String(dataSaver));
    localStorage.setItem("zet_hidegore", String(hideGore));
    localStorage.setItem("zet_lang", preferredLang);
    toast.success("Configuración guardada");
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
        {/* Playback */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">▶ Reproducción</h2>
          <div className="space-y-1">
            <div className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
              <div>
                <p className="text-sm text-foreground">Reproducir siguiente automáticamente</p>
                <p className="text-[10px] text-muted-foreground">Al terminar, reproduce el siguiente episodio</p>
              </div>
              <Switch checked={autoPlay} onCheckedChange={setAutoPlay} />
            </div>
            <div className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
              <div>
                <p className="text-sm text-foreground">Mostrar cuenta regresiva</p>
                <p className="text-[10px] text-muted-foreground">Temporizador antes del siguiente episodio</p>
              </div>
              <Switch checked={countdown} onCheckedChange={setCountdown} />
            </div>
          </div>
        </div>

        {/* Language */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">🌐 Idioma Preferido</h2>
          <div className="flex gap-2">
            {[
              { key: "latino", label: "🇲🇽 Latino" },
              { key: "castellano", label: "🇪🇸 Castellano" },
              { key: "sub", label: "🇺🇸 Sub (Inglés)" },
            ].map((lang) => (
              <button
                key={lang.key}
                onClick={() => setPreferredLang(lang.key)}
                className={`flex-1 py-3 rounded-xl text-xs font-medium transition-all ${
                  preferredLang === lang.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-muted"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Network */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">📡 Red y Contenido</h2>
          <div className="space-y-1">
            <div className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
              <div>
                <p className="text-sm text-foreground">Modo Ahorro de Datos</p>
                <p className="text-[10px] text-muted-foreground">Fuerza calidad 360p, desactiva previsualizaciones</p>
              </div>
              <Switch checked={dataSaver} onCheckedChange={setDataSaver} />
            </div>
            <div className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
              <div>
                <p className="text-sm text-foreground">Ocultar contenido Gore</p>
                <p className="text-[10px] text-muted-foreground">Filtra anime con violencia extrema</p>
              </div>
              <Switch checked={hideGore} onCheckedChange={setHideGore} />
            </div>
          </div>
        </div>

        {/* Accent color */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">🎨 Color de Acento</h2>
          <div className="bg-secondary rounded-xl p-4">
            <div className="flex justify-around">
              {ACCENT_COLORS.map((c) => {
                const isSelected = selectedAccent.name === c.name;
                return (
                  <button
                    key={c.name}
                    onClick={() => handleAccentChange(c)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div
                      className={`w-12 h-12 rounded-full transition-all duration-300 flex items-center justify-center ${
                        isSelected ? "ring-2 ring-offset-2 ring-offset-background scale-110" : "hover:scale-105"
                      }`}
                      style={{
                        backgroundColor: c.hex,
                        ringColor: isSelected ? c.hex : undefined,
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
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}
