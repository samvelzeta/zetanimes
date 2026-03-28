import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/profile" className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <h1 className="text-base font-black text-foreground">Configuración</h1>
      </div>
      <div className="px-4 pt-6 space-y-6">
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">▶ Reproducción</h2>
          <div className="space-y-1">
            <div className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
              <div><p className="text-sm text-foreground">Reproducir siguiente automáticamente</p><p className="text-[10px] text-muted-foreground">Al terminar, reproduce el siguiente episodio</p></div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
              <div><p className="text-sm text-foreground">Mostrar cuenta regresiva</p><p className="text-[10px] text-muted-foreground">Temporizador antes del siguiente episodio</p></div>
              <Switch />
            </div>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">🌐 Idioma Preferido</h2>
          <div className="flex gap-2">
            {["🇲🇽 Latino", "🇪🇸 Castellano", "🇺🇸 Sub (Inglés)"].map((lang, i) => (
              <button key={lang} className={`flex-1 py-3 rounded-xl text-xs font-medium transition-all ${i === 2 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{lang}</button>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">📡 Red y Contenido</h2>
          <div className="space-y-1">
            <div className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3">
              <div><p className="text-sm text-foreground">Modo Ahorro de Datos</p><p className="text-[10px] text-muted-foreground">Fuerza calidad 360p, desactiva previsualizaciones</p></div>
              <Switch />
            </div>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">🎨 Color de Acento</h2>
          <div className="flex gap-3">
            {[{ name: "Naranja", color: "#FF4500" }, { name: "Púrpura", color: "#9333EA" }, { name: "Verde", color: "#22C55E" }, { name: "Azul", color: "#3B82F6" }, { name: "Rosa", color: "#EC4899" }].map((c) => (
              <button key={c.name} className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full border-2 border-border" style={{ backgroundColor: c.color }} />
                <span className="text-[10px] text-muted-foreground">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
