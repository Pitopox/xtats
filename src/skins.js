/**
 * XTATS · estilos visuales (Pink, Black, White).
 *
 * Tailwind usa variables CSS para las familias de color (ver tailwind.config.js),
 * así que cada estilo solo redefine las variables y toda la app cambia.
 *  - Pink:  el original, pastel y "de sueño".
 *  - Black: fondo negro, neón y tipografía monoespaciada, tipo terminal.
 *  - White: blanco puro, texto casi negro y acento azul, estilo red social minimalista.
 *
 * Las pantallas de prisión y Modo Sincero fijan data-skin="pink" para verse igual en todos.
 */
export const SKINS = ["pink", "black", "white"];
export const FAMILIES = ["pink", "rose", "slate", "amber", "violet", "sky", "orange", "stone"];
export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const scale = (list) => Object.fromEntries(SHADES.map((s, i) => [s, hex(list[i])]));

/* ---------- Pink: paleta original de Tailwind ---------- */
const PINK = {
  pink: scale(["#fdf2f8", "#fce7f3", "#fbcfe8", "#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#be185d", "#9d174d", "#831843", "#500724"]),
  rose: scale(["#fff1f2", "#ffe4e6", "#fecdd3", "#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c", "#9f1239", "#881337", "#4c0519"]),
  slate: scale(["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a", "#020617"]),
  amber: scale(["#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f", "#451a03"]),
  violet: scale(["#f5f3ff", "#ede9fe", "#ddd6fe", "#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#2e1065"]),
  sky: scale(["#f0f9ff", "#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1", "#075985", "#0c4a6e", "#082f49"]),
  orange: scale(["#fff7ed", "#ffedd5", "#fed7aa", "#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c", "#9a3412", "#7c2d12", "#431407"]),
  stone: scale(["#fafaf9", "#f5f5f4", "#e7e5e4", "#d6d3d1", "#a8a29e", "#78716c", "#57534e", "#44403c", "#292524", "#1c1917", "#0c0a09"]),
  white: hex("#ffffff"),
  screen: hex("#fdf7f9"),
};

/* ---------- Black: neón sobre negro ---------- */
const NIGHT = hex("#060907");
const WHITE = [255, 255, 255];
/** Fondos oscuros teñidos (50–200), neón (300–400) y luego tonos cada vez más claros. */
function neon(color) {
  const N = hex(color);
  const steps = [0.05, 0.09, 0.16];
  const light = [0.25, 0.45, 0.6, 0.75, 0.85, 0.92];
  return Object.fromEntries(SHADES.map((s, i) => [s, i < 3 ? mix(NIGHT, N, steps[i]) : i < 5 ? N : mix(N, WHITE, light[i - 5])]));
}
/** Neutro invertido: 50 casi negro, 950 casi blanco. */
function inverted(lightColor) {
  const L = hex(lightColor);
  const t = [0.02, 0.05, 0.1, 0.2, 0.4, 0.55, 0.7, 0.85, 0.92, 0.96, 0.99];
  return Object.fromEntries(SHADES.map((s, i) => [s, mix(NIGHT, L, t[i])]));
}
const BLACK = {
  pink: neon("#39ff14"), // verde terminal
  rose: neon("#00f0ff"), // cian
  slate: inverted("#eafff0"),
  amber: neon("#ffe600"),
  violet: neon("#b026ff"),
  sky: neon("#00b3ff"),
  orange: neon("#ff7a00"),
  stone: inverted("#f2f2f2"),
  white: hex("#0b0f0c"),
  screen: hex("#040605"),
};

/* ---------- White: blanco, casi negro y azul ---------- */
const BLUE = scale(["#e8f5fd", "#d2ebfb", "#a5d7f7", "#1d9bf0", "#1d9bf0", "#1a8cd8", "#1a8cd8", "#156aa6", "#0f4e7a", "#0b3a5c", "#062135"]);
const GRAY = scale(["#f7f9f9", "#eff3f4", "#e1e8ed", "#cfd9de", "#8b98a5", "#536471", "#3d4a55", "#0f1419", "#0f1419", "#0f1419", "#000000"]);
const WHITE_SKIN = {
  pink: BLUE,
  rose: scale(["#f7f9f9", "#eff3f4", "#e1e8ed", "#1d9bf0", "#536471", "#0f1419", "#0f1419", "#0f1419", "#0f1419", "#0f1419", "#000000"]),
  slate: GRAY,
  amber: PINK.amber,
  violet: GRAY,
  sky: BLUE,
  orange: GRAY,
  stone: GRAY,
  white: hex("#ffffff"),
  screen: hex("#ffffff"),
};

const PALETTES = { pink: PINK, black: BLACK, white: WHITE_SKIN };

function vars(p) {
  const lines = [];
  for (const f of FAMILIES) for (const s of SHADES) lines.push(`--c-${f}-${s}: ${p[f][s].join(" ")};`);
  lines.push(`--c-white: ${p.white.join(" ")};`, `--c-screen: ${p.screen.join(" ")};`);
  return lines.join(" ");
}

/** CSS con las variables de cada estilo y los ajustes propios de Black y White. */
export const SKIN_CSS = `
:root, [data-skin="pink"] { ${vars(PINK)} }
[data-skin="black"] { ${vars(BLACK)} }
[data-skin="white"] { ${vars(WHITE_SKIN)} }

[data-skin="black"] { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: -0.01em; }
[data-skin="black"] .text-pink-400, [data-skin="black"] .text-pink-500 { text-shadow: 0 0 10px rgb(var(--c-pink-400) / .55); }
[data-skin="black"] [class*="shadow-"] { box-shadow: 0 0 0 1px rgb(var(--c-pink-200) / .7), 0 0 28px -14px rgb(var(--c-pink-400) / .5) !important; }
[data-skin="black"] ::selection { background: rgb(var(--c-pink-400)); color: rgb(var(--c-white)); }

[data-skin="white"] { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
[data-skin="white"] [class*="shadow-"] { box-shadow: none !important; }
[data-skin="white"] .rounded-3xl { border-radius: 16px; }
[data-skin="white"] .font-extralight, [data-skin="white"] .font-light { font-weight: 800; letter-spacing: -0.03em; }
[data-skin="white"] .backdrop-blur { -webkit-backdrop-filter: none; backdrop-filter: none; }

[data-skin="pink"] .nd-skin-only-black, [data-skin="white"] .nd-skin-only-black { display: none; }
`;

/** Configuración de colores de Tailwind basada en variables (la usan Vite y el CDN). */
export function tailwindColors() {
  const fam = (f) => Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--c-${f}-${s}) / <alpha-value>)`]));
  return { ...Object.fromEntries(FAMILIES.map((f) => [f, fam(f)])), white: "rgb(var(--c-white) / <alpha-value>)", screen: "rgb(var(--c-screen) / <alpha-value>)" };
}
