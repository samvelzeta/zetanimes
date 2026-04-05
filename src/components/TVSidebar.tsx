import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, History, LayoutGrid, User, Menu, X } from "lucide-react";

const navItems = [
  { path: "/", icon: Home, label: "Inicio" },
  { path: "/recent", icon: History, label: "Recientes" },
  { path: "/directory", icon: LayoutGrid, label: "Directorio" },
  { path: "/profile", icon: User, label: "Perfil" },
];

export default function TVSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Auto-open when mouse hits left edge (x === 0)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (e.clientX === 0) {
      setOpen(true);
    } else if (e.clientX > 260 && open) {
      setOpen(false);
    }
  }, [open]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <>
      {/* Menu button - always visible */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="fixed top-4 left-4 z-[100] w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-primary/70 transition-all"
      >
        {open ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
      </button>

      {/* Sidebar overlay */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full z-[90] transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: "240px" }}
      >
        {/* Netflix-style gradient: solid black to transparent */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 60%, rgba(0,0,0,0) 100%)",
          }}
        />

        <nav className="relative z-10 flex flex-col gap-2 pt-24 px-6">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-lg font-medium transition-all ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.5} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Click-away */}
      {open && (
        <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
      )}
    </>
  );
}
