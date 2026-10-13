import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { GLOBAL_CSS } from "./styles/global.js";

// Variables de los estilos (Pink/Black/White) y animaciones: se inyectan una sola vez
const style = document.createElement("style");
style.textContent = GLOBAL_CSS;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: el service worker solo se registra en producción (npm run build)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
