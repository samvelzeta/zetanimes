// Forzado global de Chrome externo para TODA la app cuando corre dentro del APK/WebView.
// - Sobrescribe window.open para redirigir vía intent://chrome.
// - Captura clicks en <a target="_blank"> o con href http(s) y los lanza a Chrome.
// - No afecta a navegadores normales (PC/móvil Chrome): isApkWebView() retorna false.
//
// Esto cubre los popups de Adsterra (banners de Home/secciones, AdCard, overlay del
// reproductor, motor fantasma premium, etc.) sin tener que tocar cada componente.
import { isApkWebView, openExternalChrome } from "./apk-intent";

let installed = false;

export function installApkForceChrome() {
  if (installed) return;
  if (typeof window === "undefined") return;
  if (!isApkWebView()) return;
  installed = true;

  // 1) Override window.open — Adsterra y la mayoría de redes la usan para el popup.
  const originalOpen = window.open.bind(window);
  window.open = function patchedOpen(url?: string | URL, target?: string, features?: string) {
    try {
      const href = typeof url === "string" ? url : url ? String(url) : "";
      if (href && /^https?:\/\//i.test(href)) {
        openExternalChrome(href);
        return null;
      }
    } catch { /* noop */ }
    return originalOpen(url as any, target as any, features as any);
  } as typeof window.open;

  // 2) Capturar clicks en anchors externos (target=_blank o http(s)).
  document.addEventListener(
    "click",
    (e) => {
      const path = (e.composedPath?.() ?? []) as EventTarget[];
      const anchor = path.find(
        (n) => n instanceof HTMLAnchorElement
      ) as HTMLAnchorElement | undefined;
      if (!anchor) return;
      const href = anchor.href || "";
      if (!/^https?:\/\//i.test(href)) return;
      // Solo interceptar enlaces que abrirían fuera de la SPA: target=_blank o dominio externo.
      const sameOrigin = href.startsWith(window.location.origin);
      if (sameOrigin && anchor.target !== "_blank") return;
      e.preventDefault();
      e.stopPropagation();
      openExternalChrome(href);
    },
    true
  );
}
