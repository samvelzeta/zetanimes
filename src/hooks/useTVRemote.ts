// Navegación con flechas tipo D-Pad para Smart TVs (control remoto).
// SOLO se activa en modo TV — no afecta a usuarios PC/móvil.
// Mueve el foco entre elementos focusables (<a>, <button>, [tabindex]) según dirección de flecha.
import { useEffect } from "react";
import { useIsTV } from "@/hooks/useIsTV";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled])';

function getFocusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null && !el.hasAttribute("data-tv-skip")
  );
}

function getRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
}

/** Encuentra el siguiente foco en la dirección dada, priorizando proximidad espacial. */
function findNext(current: HTMLElement, dir: "up" | "down" | "left" | "right"): HTMLElement | null {
  const all = getFocusables();
  const cur = getRect(current);
  let best: { el: HTMLElement; dist: number } | null = null;

  for (const el of all) {
    if (el === current) continue;
    const r = getRect(el);
    let inDir = false;
    let primary = 0; // distancia en eje principal
    let secondary = 0; // distancia en eje perpendicular

    switch (dir) {
      case "up":
        inDir = r.bottom <= cur.top + 5;
        primary = cur.top - r.bottom;
        secondary = Math.abs(r.x - cur.x);
        break;
      case "down":
        inDir = r.top >= cur.bottom - 5;
        primary = r.top - cur.bottom;
        secondary = Math.abs(r.x - cur.x);
        break;
      case "left":
        inDir = r.right <= cur.left + 5;
        primary = cur.left - r.right;
        secondary = Math.abs(r.y - cur.y);
        break;
      case "right":
        inDir = r.left >= cur.right - 5;
        primary = r.left - cur.right;
        secondary = Math.abs(r.y - cur.y);
        break;
    }

    if (!inDir) continue;
    // peso: el doble el desvío secundario para preferir alineación
    const dist = primary + secondary * 2;
    if (!best || dist < best.dist) best = { el, dist };
  }
  return best?.el ?? null;
}

export function useTVRemote() {
  const isTV = useIsTV();

  useEffect(() => {
    if (!isTV) return;

    const onKey = (e: KeyboardEvent) => {
      const key = e.key;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return;

      const active = (document.activeElement as HTMLElement) || getFocusables()[0];
      if (!active) return;

      // Si el foco está en un input/textarea, no robarlo
      const tag = active.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const dir = key.replace("Arrow", "").toLowerCase() as "up" | "down" | "left" | "right";
      const next = findNext(active, dir);
      if (next) {
        e.preventDefault();
        next.focus({ preventScroll: false });
        next.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isTV]);
}
