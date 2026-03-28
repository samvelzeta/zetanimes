import { User, Crown, Heart, Eye, CheckCircle, Clock, Settings, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

const LIST_TABS = [
  { value: "favorites", label: "Favoritos", Icon: Heart },
  { value: "watching", label: "Viendo", Icon: Eye },
  { value: "completed", label: "Terminados", Icon: CheckCircle },
  { value: "plan_to_watch", label: "Ver Después", Icon: Clock },
];

export default function Profile() {
  return (
    <div className="min-h-screen pt-8 px-4 pb-24">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="relative w-24 h-24 rounded-full overflow-hidden mb-3 ring-1 ring-border">
          <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <span className="text-2xl font-black text-white">Z</span>
          </div>
        </div>
        <h1 className="text-lg font-black text-foreground">Invitado</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Inicia sesión para guardar tu progreso</p>
        <div className="flex gap-6 mt-5">
          <div className="text-center"><p className="text-xl font-black text-foreground">0</p><p className="text-[10px] text-muted-foreground font-medium">En Listas</p></div>
          <div className="w-px bg-border" />
          <div className="text-center"><p className="text-xl font-black text-foreground">0</p><p className="text-[10px] text-muted-foreground font-medium">Episodios</p></div>
          <div className="w-px bg-border" />
          <div className="text-center"><p className="text-xl font-black text-foreground">0.0</p><p className="text-[10px] text-muted-foreground font-medium">Horas</p></div>
        </div>
      </div>
      <div className="flex gap-0 rounded-2xl overflow-hidden border border-primary mb-6">
        {LIST_TABS.map(({ value, label, Icon }) => (
          <button key={value} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-medium bg-primary/10 text-primary first:rounded-l-2xl last:rounded-r-2xl">
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground text-sm">No hay animes en esta lista</p>
      </div>
      <div className="space-y-2 mt-6">
        <Link to="/settings" className="flex items-center gap-3 px-4 py-3 bg-secondary rounded-xl">
          <Settings className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-foreground">Configuración</span>
        </Link>
      </div>
    </div>
  );
}
