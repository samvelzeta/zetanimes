import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
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

// Aplicar reduced-motion al inicio si el usuario lo activó
if (localStorage.getItem("zet_reduced_motion") === "true") {
  document.documentElement.classList.add("zet-reduced-motion");
}

createRoot(document.getElementById("root")!).render(<App />);
