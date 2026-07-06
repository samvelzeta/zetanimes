import { Link, useLocation } from "react-router-dom";

/* ============================================================
 *  Iconos steampunk personalizados
 *  - Inicio: máquina de vapor (caldera + chimenea + vapor)
 *  - Recientes: 2 engranajes (grande con manecillas + pequeño)
 *  - Buscar: llave inglesa con 5 rayos (energía)
 *  - Directorio: nube de neblina/vapor
 *  - Perfil: cabeza robot CUADRADA con tornillos en el cuerpo
 * ============================================================ */

const baseClass = "w-[24px] h-[24px]";

// INICIO — Máquina de vapor (caldera redonda + chimenea + vapor saliendo)
const SteamMachine = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 28 28" className={baseClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    {/* Caldera principal (tanque cilíndrico horizontal) */}
    <rect x="3" y="14" width="16" height="9" rx="2"
      fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
    {/* Visor de presión */}
    <circle cx="7.5" cy="18.5" r="1.6" />
    <circle cx="7.5" cy="18.5" r="0.4" fill="currentColor" />
    {/* Chimenea */}
    <rect x="14.5" y="8" width="4" height="6.5" rx="0.5"
      fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
    <rect x="13.8" y="7.5" width="5.4" height="1.2" rx="0.3" fill="currentColor" />
    {/* Vapor saliendo (3 nubes) */}
    <path d="M15 5.5c0.6-0.6 1.4-0.6 2 0M17.5 4c0.5-0.5 1.2-0.5 1.7 0M19.5 5c0.4-0.4 1-0.4 1.4 0" strokeWidth="1.4" />
    {/* Ruedas */}
    <circle cx="7" cy="24" r="1.6" fill={active ? "currentColor" : "none"} />
    <circle cx="15" cy="24" r="1.6" fill={active ? "currentColor" : "none"} />
    {/* Pitón/válvula derecha */}
    <line x1="19" y1="16.5" x2="22" y2="16.5" />
    <circle cx="22.5" cy="16.5" r="1" fill="currentColor" />
  </svg>
);

// RECIENTES — Dos engranajes engranados (grande con reloj + pequeño girando)
const DualGearClock = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 28 28" className={baseClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    {/* Engranaje grande (con reloj dentro) */}
    <circle cx="11" cy="14" r="7" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} />
    {/* Dientes del engranaje grande */}
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
      <rect key={deg} x="10.2" y="4.5" width="1.6" height="2"
        transform={`rotate(${deg} 11 14)`} fill="currentColor" />
    ))}
    {/* Manecillas de reloj dentro */}
    <line x1="11" y1="14" x2="11" y2="10.5" strokeWidth={active ? 2 : 1.6} />
    <line x1="11" y1="14" x2="13.5" y2="14" strokeWidth={active ? 2 : 1.6} />
    <circle cx="11" cy="14" r="0.8" fill="currentColor" />
    {/* Engranaje pequeño arriba derecha */}
    <circle cx="22" cy="7" r="3" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
    {[0, 60, 120, 180, 240, 300].map((deg) => (
      <rect key={`s${deg}`} x="21.5" y="3" width="1" height="1.5"
        transform={`rotate(${deg} 22 7)`} fill="currentColor" />
    ))}
    <circle cx="22" cy="7" r="0.6" fill="currentColor" />
  </svg>
);

// BUSCAR — Llave inglesa con 5 rayos de energía saliendo
const KeyWithRays = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 28 28" className={baseClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    {/* Cabeza de llave (anillo) */}
    <circle cx="9" cy="14" r="4.5" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.15 : 0} />
    <circle cx="9" cy="14" r="1.5" />
    {/* Cuerpo de la llave */}
    <line x1="13.2" y1="14" x2="22" y2="14" strokeWidth={active ? 2.6 : 2.2} />
    {/* Dientes de la llave */}
    <path d="M19 14v2.5M21 14v3M22 14v-2" strokeWidth="1.6" />
    {/* 5 rayos saliendo del anillo (estrella de energía) */}
    {[0, 72, 144, 216, 288].map((deg) => (
      <line key={deg}
        x1="9" y1="7.5" x2="9" y2="6"
        transform={`rotate(${deg} 9 14)`}
        strokeWidth="1.6"
      />
    ))}
  </svg>
);

// DIRECTORIO — Nube de vapor/neblina (3 burbujas conectadas)
const FogCloud = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 28 28" className={baseClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    {/* Cuerpo principal de la nube */}
    <path d="M6 18c-2 0-3.5-1.5-3.5-3.5S4 11 6 11c0.4-2.5 2.7-4.5 5.5-4.5s5.1 2 5.5 4.5c0.3 0 0.5 0 0.8 0.05 2 0.3 3.7 2 3.7 4.2 0 2.4-1.9 4.2-4.2 4.2H6z"
      fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
    {/* Líneas de neblina debajo */}
    <line x1="5" y1="22" x2="13" y2="22" strokeWidth="1.4" />
    <line x1="9" y1="24.5" x2="19" y2="24.5" strokeWidth="1.4" />
    <line x1="15" y1="22" x2="22" y2="22" strokeWidth="1.4" />
  </svg>
);

// PERFIL — Cabeza de robot CUADRADA con tornillos en el cuerpo
const RobotHead = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 28 28" className={baseClass} fill="none" stroke="currentColor"
    strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
    {/* Antena */}
    <line x1="14" y1="3" x2="14" y2="5.5" />
    <circle cx="14" cy="2.3" r="0.9" fill="currentColor" />
    {/* Cabeza CUADRADA */}
    <rect x="6" y="5.5" width="16" height="13" rx="1.5"
      fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
    {/* Ojos */}
    <circle cx="10.5" cy="11" r="1.3" fill={active ? "hsl(var(--background))" : "currentColor"} />
    <circle cx="17.5" cy="11" r="1.3" fill={active ? "hsl(var(--background))" : "currentColor"} />
    {/* Boca (línea de circuitos) */}
    <line x1="10" y1="15.5" x2="18" y2="15.5" strokeWidth="1.5" />
    <line x1="11.5" y1="14.5" x2="11.5" y2="16.5" strokeWidth="1.2" />
    <line x1="14" y1="14.5" x2="14" y2="16.5" strokeWidth="1.2" />
    <line x1="16.5" y1="14.5" x2="16.5" y2="16.5" strokeWidth="1.2" />
    {/* Cuerpo trapezoidal (hombros) */}
    <path d="M5 23l1.5-3h15L23 23v2H5v-2z"
      fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.12 : 0} />
    {/* Tornillos en línea sobre el cuerpo (3 en hilera) */}
    <circle cx="10" cy="22" r="0.8" fill="currentColor" />
    <circle cx="14" cy="22" r="0.8" fill="currentColor" />
    <circle cx="18" cy="22" r="0.8" fill="currentColor" />
    {/* Tornillos en esquinas de la cabeza */}
    <circle cx="7.5" cy="7" r="0.5" fill="currentColor" />
    <circle cx="20.5" cy="7" r="0.5" fill="currentColor" />
    <circle cx="7.5" cy="17" r="0.5" fill="currentColor" />
    <circle cx="20.5" cy="17" r="0.5" fill="currentColor" />
  </svg>
);

const navItems: {
  path: string;
  label: string;
  Icon: (p: { active: boolean }) => JSX.Element;
}[] = [
  { path: "/", label: "Inicio", Icon: SteamMachine },
  { path: "/recent", label: "Recientes", Icon: DualGearClock },
  { path: "/search", label: "Buscar", Icon: KeyWithRays },
  { path: "/directory", label: "Directorio", Icon: FogCloud },
  { path: "/profile", label: "Perfil", Icon: RobotHead },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl safe-area-bottom lg:hidden">
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
