import { Link, useLocation } from "react-router-dom";

/* ============================================================
 *  Iconos steampunk personalizados — más detallados y reconocibles
 *  Estilo: forma principal nítida + 1-2 detalles steampunk sutiles
 *  (tornillos, dientes pequeños, válvula). Activo: relleno + glow.
 * ============================================================ */

const baseClass = "w-[22px] h-[22px]";

// INICIO: casa nítida con tornillo en cada esquina del techo
const HomeIcon = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    {/* Techo */}
    <path d="M3 11.5L12 4l9 7.5" />
    {/* Cuerpo de casa */}
    <path d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
    {/* Puerta */}
    <path d="M10 20v-5a2 2 0 014 0v5" stroke={active ? "currentColor" : "currentColor"} strokeWidth={active ? 2 : 1.6} />
    {/* Tornillos decorativos en esquinas del techo */}
    <circle cx="4" cy="11.8" r="0.6" fill="currentColor" />
    <circle cx="20" cy="11.8" r="0.6" fill="currentColor" />
  </svg>
);

// RECIENTES: reloj clásico claro (manecillas grandes) con dientes sutiles
const ClockIcon = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} />
    {/* 4 marcas cardinales como dientes */}
    <line x1="12" y1="3" x2="12" y2="4.5" />
    <line x1="12" y1="19.5" x2="12" y2="21" />
    <line x1="3" y1="12" x2="4.5" y2="12" />
    <line x1="19.5" y1="12" x2="21" y2="12" />
    {/* Manecillas */}
    <path d="M12 7.5V12l4 2.5" strokeWidth={active ? 2.4 : 2} />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

// BUSCAR: lupa grande clara con tornillo en el mango
const SearchIcon = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
    {/* Lupa */}
    <circle cx="10" cy="10" r="6.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
    {/* Mango */}
    <line x1="15" y1="15" x2="20.5" y2="20.5" strokeWidth={active ? 2.6 : 2.2} />
    {/* Tornillo en la unión del mango */}
    <circle cx="14.6" cy="14.6" r="0.8" fill="currentColor" />
    {/* Brillo interno */}
    {active && <circle cx="8" cy="8" r="1.5" fill="hsl(var(--primary-foreground))" fillOpacity={0.4} />}
  </svg>
);

// DIRECTORIO: libro/biblioteca con engranaje pequeño en lomo (más reconocible que engranaje solo)
const LibraryIcon = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    {/* 3 libros verticales */}
    <rect x="3.5" y="5" width="4" height="15" rx="0.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
    <rect x="9" y="5" width="4" height="15" rx="0.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} />
    <rect x="14.5" y="7" width="4" height="13" rx="0.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
    {/* Líneas en lomos */}
    <line x1="3.5" y1="9" x2="7.5" y2="9" />
    <line x1="14.5" y1="11" x2="18.5" y2="11" />
    {/* Engranaje pequeño steampunk en libro central */}
    <circle cx="11" cy="13" r="1.2" fill="currentColor" />
    <line x1="11" y1="11.2" x2="11" y2="10.5" strokeWidth="1.4" />
    <line x1="11" y1="14.8" x2="11" y2="15.5" strokeWidth="1.4" />
  </svg>
);

// PERFIL: silueta de persona clara con engrane pequeño (configuración) en hombro
const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" className={baseClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    {/* Cabeza */}
    <circle cx="12" cy="8" r="3.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.2 : 0} />
    {/* Hombros */}
    <path d="M4.5 21c0-4.2 3.4-7 7.5-7s7.5 2.8 7.5 7" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} />
    {/* Engranaje mini sobre el hombro derecho */}
    <circle cx="18.5" cy="6" r="1.6" />
    <line x1="18.5" y1="3.8" x2="18.5" y2="3" strokeWidth="1.2" />
    <line x1="18.5" y1="9" x2="18.5" y2="8.2" strokeWidth="1.2" />
    <line x1="16.3" y1="6" x2="15.5" y2="6" strokeWidth="1.2" />
    <line x1="21.5" y1="6" x2="20.7" y2="6" strokeWidth="1.2" />
  </svg>
);

const navItems: {
  path: string;
  label: string;
  Icon: (p: { active: boolean }) => JSX.Element;
}[] = [
  { path: "/", label: "Inicio", Icon: HomeIcon },
  { path: "/recent", label: "Recientes", Icon: ClockIcon },
  { path: "/search", label: "Buscar", Icon: SearchIcon },
  { path: "/directory", label: "Directorio", Icon: LibraryIcon },
  { path: "/profile", label: "Perfil", Icon: ProfileIcon },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ path, label, Icon }) => {
          const isActive = path === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={
                isActive
                  ? { filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.75))" }
                  : undefined
              }
            >
              <div
                className={`transition-transform duration-300 ${
                  isActive ? "scale-110" : ""
                }`}
              >
                <Icon active={isActive} />
              </div>
              <span className="text-[10px] font-medium tracking-wide">
                {label}
              </span>
              {isActive && (
                <span className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
