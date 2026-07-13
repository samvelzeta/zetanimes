import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 🔒 Silenciar consola en producción para no filtrar datos internos
(() => {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
  if (isLocal) return;
  const noop = () => {};
  try {
    // Mantenemos console.error real solo para crashes críticos del runtime.
    (console as any).log = noop;
    (console as any).info = noop;
    (console as any).warn = noop;
    (console as any).debug = noop;
    (console as any).trace = noop;
    (console as any).table = noop;
    (console as any).dir = noop;
    (console as any).group = noop;
    (console as any).groupCollapsed = noop;
    (console as any).groupEnd = noop;
  } catch { /* noop */ }
})();
import { initAccentColor } from "./lib/accent";
import { preventWebViewReload } from "./lib/webview";
import { initFont } from "./pages/Settings";
import { installApkForceChrome } from "./lib/apk-force-chrome";
import { isWebView } from "./lib/webview";

initAccentColor();
initFont();
preventWebViewReload();
// Solo se activa cuando isApkWebView() es true; en PC/móvil normal es no-op.
installApkForceChrome();

// Marca el documento cuando corre dentro de APK/WebView para desactivar efectos pesados
if (isWebView()) {
  document.documentElement.classList.add("zet-apk-webview");
}

// Aplicar preferencias visuales al inicio (antes de que React monte) para evitar flash
if (localStorage.getItem("zet_reduced_motion") === "true") {
  document.documentElement.classList.add("zet-reduced-motion");
}
if (localStorage.getItem("zet_datasaver") === "true") {
  document.documentElement.classList.add("zet-data-saver");
}

createRoot(document.getElementById("root")!).render(<App />);
