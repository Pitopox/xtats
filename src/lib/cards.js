import { T } from "../game/config.js";
import { fmt, fmtTime } from "../game/engine.js";

/* =========================================================================
   7. TARJETAS 9:16 (canvas)
   ========================================================================= */
export const CARD_W = 1080;
export const CARD_H = 1920;
export const FONT = "Manrope, ui-sans-serif, system-ui, sans-serif";

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function newCard() {
  const c = document.createElement("canvas");
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  g.addColorStop(0, "#fde7f1");
  g.addColorStop(0.55, "#fffafc");
  g.addColorStop(1, "#eef1f6");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow = ctx.createRadialGradient(CARD_W / 2, 380, 40, CARD_W / 2, 380, 760);
  glow.addColorStop(0, "rgba(255,255,255,0.9)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f472b6";
  ctx.beginPath();
  ctx.arc(CARD_W / 2 - 150, 160, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#475569";
  ctx.font = `300 46px ${FONT}`;
  ctx.fillText("X T A T S", CARD_W / 2 + 10, 176);
  return [c, ctx];
}

export function cardText(ctx, text, y, { size = 40, weight = 400, color = "#475569", max = 900 } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  const words = String(text).split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(line, CARD_W / 2, yy);
      line = w;
      yy += size * 1.3;
    } else line = test;
  }
  ctx.fillText(line, CARD_W / 2, yy);
  return yy;
}

export function cardFooter(ctx, t) {
  cardText(ctx, t.card.footer, CARD_H - 110, { size: 34, color: "#94a3b8" });
}

export function drawCurve(ctx, history, x, y, w, h) {
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  rrect(ctx, x - 30, y - 30, w + 60, h + 60, 40);
  ctx.fill();
  const pts = history.length > 1 ? history : [history[0], history[0]];
  const px = (i) => x + (i * w) / (pts.length - 1);
  const py = (s) => y + ((5 - s) * h) / 4.9;
  [T.elite, T.warning, T.locked].forEach((v) => {
    ctx.strokeStyle = "rgba(148,163,184,0.5)";
    ctx.setLineDash([10, 14]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, py(v));
    ctx.lineTo(x + w, py(v));
    ctx.stroke();
  });
  ctx.setLineDash([]);
  const area = ctx.createLinearGradient(0, y, 0, y + h);
  area.addColorStop(0, "rgba(249,168,212,0.5)");
  area.addColorStop(1, "rgba(249,168,212,0)");
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.s)) : ctx.moveTo(px(i), py(p.s))));
  ctx.lineTo(px(pts.length - 1), y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = area;
  ctx.fill();
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.s)) : ctx.moveTo(px(i), py(p.s))));
  ctx.strokeStyle = "#f472b6";
  ctx.lineWidth = 8;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.fillStyle = "#f472b6";
  ctx.beginPath();
  ctx.arc(px(pts.length - 1), py(pts[pts.length - 1].s), 14, 0, Math.PI * 2);
  ctx.fill();
}

/** Tarjeta de partida: puntaje, curva y frase. */
export function renderRunCard({ t, name, mode, outcome, time, score, history }) {
  const [c, ctx] = newCard();
  const fallen = score < T.warning;
  cardText(ctx, t.modes[mode].name.toUpperCase(), 270, { size: 30, weight: 600, color: "#94a3b8" });
  cardText(ctx, name, 420, { size: 54, weight: 500, color: "#334155" });
  cardText(ctx, fmt(score), 700, { size: 250, weight: 200, color: fallen ? "#64748b" : "#f472b6" });
  cardText(ctx, runHeadline(t, mode, outcome, time, score), 860, { size: 52, weight: 500, color: "#334155" });
  drawCurve(ctx, history, 150, 1060, 780, 420);
  cardText(ctx, t.tagline, 1640, { size: 38, color: "#64748b" });
  cardFooter(ctx, t);
  return c.toDataURL("image/png");
}

export function runHeadline(t, mode, outcome, time, score) {
  if (outcome === "prison") return mode === "speedrun" ? t.card.prisonLine(fmtTime(time)) : mode === "survival" ? t.card.survivedLine(fmtTime(time)) : t.card.prisonFreeLine;
  if (outcome === "elite") return t.card.eliteLine(fmtTime(time));
  if (outcome === "timeout") return t.card.timeoutLine;
  return t.card.freeLine(fmt(score));
}

/** Tarjeta del reto diario: puntaje y cuadrícula de emojis. */
export function renderDailyCard({ t, n, title, score, grid }) {
  const [c, ctx] = newCard();
  cardText(ctx, t.card.dailyLine(n).toUpperCase(), 290, { size: 34, weight: 600, color: "#94a3b8" });
  cardText(ctx, title, 420, { size: 60, weight: 500, color: "#334155" });
  cardText(ctx, fmt(score), 780, { size: 260, weight: 200, color: score >= T.warning ? "#f472b6" : "#64748b" });
  ctx.font = `150px ${FONT}`;
  ctx.fillText(grid, CARD_W / 2, 1100);
  cardText(ctx, t.tagline, 1500, { size: 40, color: "#64748b" });
  cardFooter(ctx, t);
  return c.toDataURL("image/png");
}

/** Tarjeta "Tu semana en XTATS". */
export function renderWeekCard({ t, name, rows }) {
  const [c, ctx] = newCard();
  cardText(ctx, t.week.label.toUpperCase(), 290, { size: 34, weight: 600, color: "#94a3b8" });
  cardText(ctx, name, 420, { size: 64, weight: 500, color: "#334155" });
  rows.forEach(([label, value], i) => {
    const y = 600 + i * 150;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    rrect(ctx, 140, y - 80, 800, 120, 36);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.font = `400 40px ${FONT}`;
    ctx.fillStyle = "#64748b";
    ctx.fillText(label, 190, y);
    ctx.textAlign = "right";
    ctx.font = `600 52px ${FONT}`;
    ctx.fillStyle = "#f472b6";
    ctx.fillText(String(value), 890, y + 2);
    ctx.textAlign = "center";
  });
  cardFooter(ctx, t);
  return c.toDataURL("image/png");
}

/** Foto con filtro XTATS: estética sobreexpuesta + puntaje flotando. */
export function composePhoto({ source, sw, sh, mirror, headY, name, score }) {
  const c = document.createElement("canvas");
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext("2d");
  const scale = Math.max(CARD_W / sw, CARD_H / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.save();
  ctx.filter = "brightness(1.1) contrast(0.88) saturate(0.82) sepia(0.1)";
  if (mirror) {
    ctx.translate(CARD_W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, (CARD_W - dw) / 2, (CARD_H - dh) / 2, dw, dh);
  ctx.restore();
  const veil = ctx.createLinearGradient(0, 0, 0, CARD_H);
  veil.addColorStop(0, "rgba(255,240,246,0.35)");
  veil.addColorStop(0.5, "rgba(255,255,255,0.08)");
  veil.addColorStop(1, "rgba(255,240,246,0.3)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const y = Math.round(headY * CARD_H);
  ctx.font = `500 44px ${FONT}`;
  const label = `${name}  ★ ${fmt(score)}`;
  const w = ctx.measureText(label).width + 90;
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.shadowColor = "rgba(236,72,153,0.35)";
  ctx.shadowBlur = 40;
  rrect(ctx, (CARD_W - w) / 2, y - 62, w, 96, 48);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.textAlign = "center";
  ctx.fillStyle = score >= T.warning ? "#ec4899" : "#475569";
  ctx.fillText(label, CARD_W / 2, y);
  ctx.font = `300 34px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText("X T A T S", CARD_W / 2, CARD_H - 90);
  return c.toDataURL("image/png");
}

/** Recorta al centro y comprime una foto de perfil (JPEG cuadrado). */
export function fileToSquareJpeg(file, size = 320) {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      c.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(src);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error("bad_image"));
    };
    img.src = src;
  });
}

/** Comprime una foto de prueba (máx. 1280 px, JPEG) para subirla al reto. */
export function fileToJpegBlob(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("bad_image"))), "image/jpeg", 0.82);
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error("bad_image"));
    };
    img.src = src;
  });
}

/** Colores de las tarjetas para compartir según el estilo elegido. */
export const CARD_THEME = {
  pink: { bg: ["#fde7f1", "#fffafc", "#eef1f6"], text: "#334155", muted: "#94a3b8", accent: "#f472b6", off: "#f1d5e2", panel: "rgba(255,255,255,0.8)", font: FONT },
  black: { bg: ["#040605", "#07100a", "#040605"], text: "#eafff0", muted: "#5f8a6b", accent: "#39ff14", off: "#16301c", panel: "rgba(57,255,20,0.06)", font: '"JetBrains Mono", ui-monospace, monospace' },
  white: { bg: ["#ffffff", "#ffffff", "#f7f9f9"], text: "#0f1419", muted: "#536471", accent: "#1d9bf0", off: "#e1e8ed", panel: "#f7f9f9", font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
};

/** Tarjeta 9:16 del resultado de un reto: estrellas de quien retó y cambio de puntaje. */
export function renderDareCard({ t, skin = "white", name, senderName, title, stars, before, after }) {
  const th = CARD_THEME[skin] ?? CARD_THEME.white;
  const c = document.createElement("canvas");
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  th.bg.forEach((col, i) => g.addColorStop(i / (th.bg.length - 1), col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.textAlign = "center";
  const txt = (s, y, size, weight, color, max = 900) => {
    ctx.font = `${weight} ${size}px ${th.font}`;
    ctx.fillStyle = color;
    const words = String(s).split(" ");
    let line = "";
    let yy = y;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > max && line) {
        ctx.fillText(line, CARD_W / 2, yy);
        line = w;
        yy += size * 1.25;
      } else line = test;
    }
    ctx.fillText(line, CARD_W / 2, yy);
    return yy;
  };
  // marca
  ctx.fillStyle = th.accent;
  ctx.beginPath();
  ctx.arc(CARD_W / 2 - 150, 160, 9, 0, Math.PI * 2);
  ctx.fill();
  txt("X T A T S", 176, 46, 600, th.text);
  // reto
  txt(t.card.dareLine(senderName).toUpperCase(), 330, 32, 600, th.muted);
  const yTitle = txt(`«${title}»`, 450, 70, 700, th.text, 880);
  // panel con estrellas
  const top = Math.max(620, yTitle + 110);
  ctx.fillStyle = th.panel;
  rrect(ctx, 110, top, 860, 560, 56);
  ctx.fill();
  if (skin === "black") {
    ctx.strokeStyle = th.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.font = `150px ${th.font}`;
  const starW = 150;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? th.accent : th.off;
    ctx.fillText("★", CARD_W / 2 + (i - 2) * starW, top + 230);
  }
  txt(`${stars}/5`, top + 330, 44, 600, th.muted);
  if (before != null && after != null) txt(`${fmt(before)} → ${fmt(after)}`, top + 460, 96, 300, th.accent);
  // persona
  txt(name, top + 720, 64, 700, th.text);
  txt(t.tagline, top + 810, 38, 400, th.muted);
  txt(t.card.footer, CARD_H - 110, 34, 400, th.muted);
  return c.toDataURL("image/png");
}

/** "2 d 4 h", "5 h 12 min", "12 min". */
export function fmtLeft(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m % 60} min` : `${m} min`;
}

export function dataUrlToBlob(url) {
  const [head, body] = url.split(",");
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
