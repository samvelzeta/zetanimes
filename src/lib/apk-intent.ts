// APK / WebView detection + bypass para abrir URLs en Chrome externo.
// El truco del intent:// fuerza a Android a lanzar Chrome real fuera del WebView
// (donde sí se valida correctamente el clic en el anuncio de Adsterra).
export function isApkWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || (navigator as any).vendor || "";
  if (!/Android/i.test(ua)) return false;
  // Android WebView clásico: "; wv)" o falta el patrón "Chrome/X Mobile" puro.
  if (/; wv\)/i.test(ua) || /\bwv\b/i.test(ua)) return true;
  if (!/Chrome\/[.0-9]+ Mobile/i.test(ua)) return true;
  // App propia
  if (/ZetAnimeApp/i.test(ua)) return true;
  return false;
}

/** Abre la URL en Chrome externo si estamos dentro del APK; si no, ventana normal. */
export function openExternalChrome(url: string): void {
  if (!url) return;
  if (isApkWebView()) {
    try {
      const clean = url.replace(/^https?:\/\//i, "");
      const intent = `intent://${clean}#Intent;scheme=https;action=android.intent.action.VIEW;package=com.android.chrome;end`;
      window.location.href = intent;
      return;
    } catch {
      // fallback abajo
    }
  }
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = url;
  }
}
