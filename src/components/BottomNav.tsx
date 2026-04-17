import { Link, useLocation } from "react-router-dom";

/* ============================================================
 *  Iconos steampunk personalizados (SVG inline, livianos).
 *  Cada uno está hecho con engranajes/válvulas/tornillos.
 * ============================================================ */

const iconClass = "w-5 h-5";

// Inicio: casa con techo de engranaje
const HomeGear = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    {/* Casa */}
    <path d="M4 11.5L12 5l8 6.5V20a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-8.5z" />
    {/* Engranaje pequeño en la chimenea */}
    <circle cx="12" cy="9.5" r="2" fill={active ? "currentColor" : "none"} />
    <path d="M12 7v-1M12 13v-1M9.5 9.5h-1M15.5 9.5h-1" strokeWidth="1.2" />
  </svg>
);

// Recientes: reloj antiguo con engranajes
const ClockGear = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    {/* Bisel exterior con dientes */}
    <circle cx="12" cy="12" r="9" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
      <line key={i} x1="12" y1="2.5" x2="12" y2="3.8"
        transform={`rotate(${deg} 12 12)`} strokeWidth="1.4" />
    ))}
    {/* Manecillas */}
    <path d="M12 7v5l3.5 2" />
    <circle cx="12" cy="12" r="1" fill={active ? "currentColor" : "none"} />
  </svg>
);

// Buscar: lupa con engranaje en el mango
const SearchGear = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    {/* Lupa */}
    <circle cx="10.5" cy="10.5" r="6" />
    {/* Dientes alrededor */}
    {[0, 60, 120, 180, 240, 300].map((deg, i) => (
      <line key={i} x1="10.5" y1="3.8" x2="10.5" y2="4.6"
        transform={`rotate(${deg} 10.5 10.5)`} strokeWidth="1.3" />
    ))}
    {/* Mango */}
    <line x1="14.8" y1="14.8" x2="20" y2="20" strokeWidth="2" />
    <circle cx="10.5" cy="10.5" r="1.5" fill={active ? "currentColor" : "none"} />
  </svg>
);

// Directorio: engranaje principal con paneles
const Catalog = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 1.8 : 1.5} strokeLinecap="round" strokeLinejoin="round">
    {/* Engranaje principal */}
    <circle cx="12" cy="12" r="5.5" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
      <rect key={i} x="11" y="3" width="2" height="2.5"
        transform={`rotate(${deg} 12 12)`} fill={active ? "currentColor" : "none"} />
    ))}
    <circle cx="12" cy="12" r="2" fill={active ? "currentColor" : "none"} />
  </svg>
);

// Perfil: persona con marco de engranaje
const ProfileGear = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    {/* Cabeza */}
    <circle cx="12" cy="9" r="3" fill={active ? "currentColor" : "none"} />
    {/* Hombros */}
    <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    {/* Tornillos decorativos en las esquinas */}
    <circle cx="4" cy="4" r="0.8" />
    <circle cx="20" cy="4" r="0.8" />
  </svg>
);

const navItems: {
  path: string;
  label: string;
  Icon: (p: { active: boolean }) => JSX.Element;
}[] = [
  { path: "/", label: "Inicio", Icon: HomeGear },
  { path: "/recent", label: "Recientes", Icon: ClockGear },
  { path: "/search", label: "Buscar", Icon: SearchGear },
  { path: "/directory", label: "Directorio", Icon: Catalog },
  { path: "/profile", label: "Perfil", Icon: ProfileGear },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ path, label, Icon }) => {
          const isActive = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              style={isActive ? { filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.6))" } : undefined}
            >
              <div className={`transition-transform duration-300 ${isActive ? "scale-110" : ""}`}>
                <Icon active={isActive} />
              </div>
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
              {isActive && <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
