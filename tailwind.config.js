import { tailwindColors } from "./src/skins.js";

/** Los colores son variables CSS para que cada estilo (Pink, Black, White) los redefina. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: { colors: tailwindColors() } },
  plugins: [],
};
