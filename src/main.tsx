import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAccentColor } from "./lib/accent";

initAccentColor();

createRoot(document.getElementById("root")!).render(<App />);
