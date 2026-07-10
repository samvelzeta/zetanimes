import { useEffect } from "react";
import { useUserCosmetics } from "@/hooks/useUserCosmetics";
import { findCursor } from "@/lib/cosmetics";

/**
 * Aplica el cursor temático del usuario logueado a nivel global.
 * Solo se activa en pantallas con puntero (matchMedia).
 */
export default function CursorApplier() {
  const { cosmetics } = useUserCosmetics();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const canUse = window.matchMedia("(pointer: fine)").matches;
    if (!canUse) return;
    const def = findCursor(cosmetics.cursor_theme);
    if (def.slug === "default") {
      document.documentElement.style.cursor = "";
    } else {
      document.documentElement.style.cursor = def.cursor;
    }
    return () => { document.documentElement.style.cursor = ""; };
  }, [cosmetics.cursor_theme]);
  return null;
}
