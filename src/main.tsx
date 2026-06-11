import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./lib/webVitals";

initWebVitals();

const container = document.getElementById("root")!;
const root = createRoot(container);
root.render(<App />);
document.body.classList.add("spa-mounted");

// Register Service Worker for PWA support
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[PWA] Service Worker registered with scope:", reg.scope);
      })
      .catch((err) => {
        console.error("[PWA] Service Worker registration failed:", err);
      });
  });
}

