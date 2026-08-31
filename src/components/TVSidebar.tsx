import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, History, LayoutGrid, User, Menu, X, Search } from "lucide-react";

const navItems = [
  { path: "/", icon: Home, label: "Inicio" },
  { path: "/search", icon: Search, label: "Buscar" },
  { path: "/recent", icon: History, label: "Recientes" },
  { path: "/directory", icon: LayoutGrid, label: "Directorio" },
  { path: "/profile", icon: User, label: "Perfil" },
];

export default function TVSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [focusIdx, setFocusIdx] = useState(0);

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

  // Keyboard navigation for TV remotes
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!open) {
        // Open with left arrow or menu key
        if (e.key === "ArrowLeft" || e.key === "ContextMenu") {
          setOpen(true);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          setFocusIdx(p => Math.max(0, p - 1));
          e.preventDefault();
          break;
        case "ArrowDown":
          setFocusIdx(p => Math.min(navItems.length - 1, p + 1));
          e.preventDefault();
          break;
        case "Enter":
        case " ":
          // Navigate to focused item
          const link = sidebarRef.current?.querySelector(`[data-nav-idx="${focusIdx}"]`) as HTMLAnchorElement;
          if (link) link.click();
          e.preventDefault();
          break;
        case "ArrowRight":
        case "Escape":
          setOpen(false);
          e.preventDefault();
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, focusIdx]);

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <>
      {/* Menu button - always visible, centered vertically */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="fixed top-1/2 -translate-y-1/2 left-4 z-[100] w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center hover:bg-primary/70 focus:bg-primary/70 focus:outline-none focus:ring-2 focus:ring-primary"
        tabIndex={0}
      >
        {open ? <X className="w-6 h-6 text-foreground" /> : <Menu className="w-6 h-6 text-foreground" />}
      </button>

      {/* Sidebar overlay — fondo sólido (sin gradientes ni transparencias: TV lento) */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full z-[90] bg-background border-r border-border ${open ? "" : "hidden"}`}
        style={{ width: "240px" }}
      >


        {/* Nav items centered vertically */}
        <nav className="relative z-10 flex flex-col gap-2 px-6 h-full justify-center">
          {navItems.map(({ path, icon: Icon, label }, idx) => {
            const isActive = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
            const isFocused = focusIdx === idx;
            return (
              <Link
                key={path}
                to={path}
                data-nav-idx={idx}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-lg font-medium ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : isFocused
                    ? "text-white bg-white/10"
                    : "text-white/70 hover:text-white hover:bg-white/5 focus:text-white focus:bg-white/10"
                } focus:outline-none focus:ring-2 focus:ring-primary`}
                tabIndex={open ? 0 : -1}
                onFocus={() => setFocusIdx(idx)}
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
