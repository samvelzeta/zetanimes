// WebView / APK detection utility

export function isWebView(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  
  // Android WebView patterns
  if (/wv/.test(ua) && /Android/.test(ua)) return true;
  // Generic WebView indicators
  if (/; wv\)/.test(ua)) return true;
  // Custom app UA (add your own app identifier)
  if (/ZetAnimeApp/.test(ua)) return true;
  // iOS WebView (not Safari)
  if (/iPhone|iPad/.test(ua) && !/Safari/.test(ua)) return true;
  // Standalone mode (PWA installed)
  if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;
  
  return false;
}

export function isAndroidWebView(): boolean {
  const ua = navigator.userAgent || "";
  return /wv/.test(ua) && /Android/.test(ua);
}

// Prevent unnecessary reloads in WebView
export function preventWebViewReload(): void {
  if (!isWebView()) return;
  
  // Prevent pull-to-refresh
  document.body.style.overscrollBehavior = "none";
  
  // Prevent orientation change reload
  let lastOrientation = window.screen?.orientation?.angle;
  window.addEventListener("orientationchange", () => {
    const newOrientation = window.screen?.orientation?.angle;
    if (lastOrientation !== newOrientation) {
      lastOrientation = newOrientation;
      // Don't reload, just update
    }
  });
}

// Save/restore video progress using localStorage
const PROGRESS_PREFIX = "time-";

export function saveVideoProgress(slug: string, episode: number, currentTime: number, duration: number): void {
  const key = `${PROGRESS_PREFIX}${slug}-${episode}`;
  localStorage.setItem(key, JSON.stringify({ currentTime, duration, timestamp: Date.now() }));
}

export function getVideoProgress(slug: string, episode: number): { currentTime: number; duration: number } | null {
  const key = `${PROGRESS_PREFIX}${slug}-${episode}`;
  try {
    const data = JSON.parse(localStorage.getItem(key) || "null");
    if (data && typeof data.currentTime === "number") return data;
    return null;
  } catch {
    return null;
  }
}
