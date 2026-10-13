/** Utilidades y motor de puntaje (funciones puras, sin React). */
import { DAILY_EFFECTS, HAPPY_WORDS, INSULTS, LOWER_IS_BETTER, NEGATIVE_WORDS, RATER_TIER, SOCIAL_MEMORY, T } from "./config.js";

/* =========================================================================
   3. UTILIDADES
   ========================================================================= */
export const cx = (...c) => c.filter(Boolean).join(" ");
export const fmt = (n, d = 2) => Number(n).toFixed(d);
export const round2 = (n) => Math.round(n * 100) / 100;
export const normalize = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const randomStars = () => pick([1, 1, 2, 3, 3, 4, 4, 5, 5, 5]);
export const money = (n, locale) => n.toLocaleString(locale, { style: "currency", currency: "USD", maximumFractionDigits: n < 10 ? 2 : 0 });
export const fmtTime = (ms) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`);
export const meta = () => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now() });

export const pad = (n) => String(n).padStart(2, "0");
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const lastDays = (n) => Array.from({ length: n }, (_, i) => dateKey(new Date(Date.now() - i * 86400000)));
export function dayNumber(d = new Date()) {
  const start = new Date(2026, 0, 1);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((today - start) / 86400000) + 1;
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const scenarioFor = (key) => hashStr(`xtats-${key}`) % DAILY_EFFECTS.length;

export function analyzeText(text) {
  const tokens = normalize(text).match(/\p{L}+/gu) ?? [];
  return { happy: tokens.filter((w) => HAPPY_WORDS.has(w)), negative: tokens.filter((w) => NEGATIVE_WORDS.has(w)) };
}
export function moderate(text) {
  let masked = false;
  const out = text.replace(/\p{L}+/gu, (w) => {
    if (!INSULTS.has(normalize(w))) return w;
    masked = true;
    return "•".repeat(w.length);
  });
  return { text: out, masked };
}

export function isBetter(mode, a, b) {
  if (a == null) return false;
  if (b == null) return true;
  return LOWER_IS_BETTER[mode] ? a < b : a > b;
}

/* =========================================================================
   4. MOTOR XTATS
   ========================================================================= */
/**
 * VIP (≥4.5) ×2.5 · Media-alta (≥3.5) ×1.2 · Promedio (≥2.0) ×0.5 · Paria (<2.0) ×0.
 * 1–2 estrellas amplifican el daño ×1.5. starsGiven = 0: sanción del sistema.
 */
export function calculateXtatsScore(currentScore, totalVotes, starsGiven, raterScore) {
  let influence;
  if (raterScore >= 4.5) influence = 2.5;
  else if (raterScore >= 3.5) influence = 1.2;
  else if (raterScore >= 2.0) influence = 0.5;
  else influence = 0;
  if (starsGiven <= 2) influence *= 1.5;
  if (influence === 0) return { score: currentScore, newTotalVotes: totalVotes };
  const newTotalVotes = totalVotes + influence;
  const newScore = Math.max(0.1, Math.min(5.0, (currentScore * totalVotes + starsGiven * influence) / newTotalVotes));
  return { score: parseFloat(newScore.toFixed(2)), newTotalVotes: parseFloat(newTotalVotes.toFixed(1)) };
}

export function rateWith(target, stars, raterScore) {
  const { score, newTotalVotes } = calculateXtatsScore(target.score, Math.min(target.weight, SOCIAL_MEMORY), stars, raterScore);
  return { ...target, score, weight: newTotalVotes, votes: (target.votes ?? 0) + 1 };
}

/** Puntaje del reto diario a partir de las opciones elegidas. */
export function dailyOutcome(scenario, picks) {
  let p = { score: 4.1, weight: 12 };
  const stars = picks.map((opt, step) => {
    const [s, tier] = DAILY_EFFECTS[scenario][step][opt];
    p = rateWith(p, s, RATER_TIER[tier]);
    return s;
  });
  return { score: p.score, stars, grid: stars.map((s) => (s >= 4 ? "⭐" : s === 3 ? "🙂" : "💀")).join("") };
}

export function influenceKey(score) {
  if (score >= 4.5) return { key: "vip", tone: "bg-pink-100 text-pink-500" };
  if (score >= 3.5) return { key: "mid", tone: "bg-rose-50 text-rose-400" };
  if (score >= 2.0) return { key: "avg", tone: "bg-slate-100 text-slate-500" };
  return { key: "pariah", tone: "bg-slate-200 text-slate-400" };
}
export function impactKey(delta) {
  if (delta <= -0.25) return "drastic";
  if (delta < 0) return "down";
  if (delta === 0) return "same";
  return delta >= 0.15 ? "upMuch" : "up";
}
export function scoreTone(score) {
  if (score >= T.elite) return "bg-pink-100 text-pink-500";
  if (score >= T.warning) return "bg-rose-50 text-rose-400";
  return "bg-slate-200 text-slate-500";
}
export const nameOf = (who, t) => (who.key ? t.names[who.key] : who.name);
