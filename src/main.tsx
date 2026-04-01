import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAccentColor } from "./lib/accent";
import { preventWebViewReload } from "./lib/webview";

initAccentColor();
preventWebViewReload();

createRoot(document.getElementById("root")!).render(<App />);
