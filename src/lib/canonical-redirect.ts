import { SITE_URL } from "@/lib/site-url";

/**
 * Redirección al dominio principal (zetanimes.top).
 *
 * Objetivo: la copia alojada en Lovable (*.lovable.app) solo sirve de espejo y
 * manda al usuario al dominio real, donde está todo conectado (backend, CDN,
 * APIs y VPS). Así no se consumen recursos de la nube de Lovable.
 *
 * - NO se redirige la vista previa del editor (id-preview--*) ni localhost.
 * - NO se redirige si la página está dentro de un iframe (editor).
 * - Se puede desactivar con VITE_REDIRECT_TO_CANONICAL="false".
 */
export function redirectToCanonicalDomain(): void {
  if (typeof window === "undefined") return;

  const enabled = (import.meta.env.VITE_REDIRECT_TO_CANONICAL as string | undefined) !== "false";
  if (!enabled) return;

  try {
    // Dentro de un iframe (editor / preview embebido) nunca redirigimos.
    if (window.top !== window.self) return;
  } catch {
    return;
  }

  const host = window.location.hostname;
  const isLovableHost = host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com");
  const isEditorPreview = host.startsWith("id-preview--") || host.includes("--preview");
  if (!isLovableHost || isEditorPreview) return;

  const target = SITE_URL.replace(/\/+$/, "");
  if (!target || target.includes(host)) return;

  const { pathname, search, hash } = window.location;
  window.location.replace(`${target}${pathname}${search}${hash}`);
}
