/**
 * XTATS v4 — "Sonríe. Sobrevive al algoritmo."
 * Sátira jugable sobre vivir bajo calificaciones sociales. React + Tailwind CSS.
 *
 * Mapa del archivo
 *  1. Configuración ........ umbrales, modos de juego, efectos del reto diario
 *  2. Datos mock ........... usuarios, posts, bots, amigos simulados, servicios
 *  3. Utilidades ........... fechas, semillas, formato, moderación
 *  4. Motor XTATS .......... calculateXtatsScore() + reto diario
 *  5. Estado ............... reducer puro + localStorage (partida, récords, semana)
 *  6. Audio y vibración .... AudioContext + navigator.vibrate
 *  7. Tarjetas ............. imágenes 9:16 en canvas (partida, reto, semana, foto)
 *  8. Componentes .......... UI por pestaña: Hoy · Jugar · Filtro · Amigos
 *  9. App .................. cascada, paranoia, ansiedad, modos, consecuencias
 *
 * Con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY definidas, el login
 * (Google/Meta), los amigos, los récords y el reto diario usan Supabase
 * (src/backend.js + supabase/schema.sql). Sin ellas, todo funciona en modo demo.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { I18N, LANGS } from "./i18n.js";
import { remote } from "./backend.js";
import { SKINS, SKIN_CSS } from "./skins.js";
import { FcGoogle } from "react-icons/fc";
import { FaFacebook } from "react-icons/fa";

/* =========================================================================
   1. CONFIGURACIÓN
   ========================================================================= */
const STORAGE_KEY = "xtats-v4";
const LANG_KEY = "xtats-lang";
const METRICS_KEY = "xtats-metrics";
const PENDING_KEY = "xtats-pending-name"; // nombre elegido antes de ir a Google/Meta
const SKIN_KEY = "xtats-skin";
const DARE_HOURS = [1, 6, 24, 72, 168];
const MAX_LOG = 20;
const HISTORY_MAX = 40;
const SOCIAL_MEMORY = 20;
const MIN_AGE = 13;

const T = { elite: 4.5, warning: 3.0, expensive: 2.5, locked: 1.5, prison: 0.1 };
const CASCADE_MS = { normal: 1300, locked: 900 };
const ANXIETY = { clicks: 8, windowMs: 1500, cooldownMs: 3000, penalty: 0.05 };

/** Reglas de cada modo de juego. */
const MODES = {
  free: { start: 4.1, cascadeAt: 3.0, paranoia: [8000, 16000] },
  speedrun: { start: 4.1, cascadeAt: 3.0, paranoia: [8000, 16000] },
  climb: { start: 4.1, cascadeAt: 3.0, paranoia: [5000, 9000], limitMs: 120000 },
  survival: { start: 4.0, cascadeAt: 3.6, paranoia: [2500, 5000], harsh: true },
};
const MODE_ORDER = ["free", "speedrun", "climb", "survival"];
const RECORD_MODES = ["speedrun", "climb", "survival"];
const LOWER_IS_BETTER = { speedrun: true, climb: true, survival: false };
const MODE_ICON = { free: "🌸", speedrun: "⏱️", climb: "🥂", survival: "🧠" };

/**
 * Reto diario: lo que provoca cada opción. Alineado por índice con
 * I18N[lang].daily.scenarios. [estrellas recibidas, nivel de quien te califica]
 */
const RATER_TIER = { vip: 4.8, mid: 3.8, avg: 2.5 };
const DAILY_EFFECTS = [
  [[[5, "vip"], [4, "mid"], [1, "vip"]], [[5, "vip"], [2, "mid"], [3, "avg"]], [[5, "vip"], [3, "mid"], [1, "vip"]]],
  [[[5, "vip"], [3, "mid"], [1, "vip"]], [[4, "mid"], [1, "vip"], [3, "avg"]], [[5, "vip"], [2, "mid"], [1, "vip"]]],
  [[[4, "mid"], [2, "mid"], [1, "vip"]], [[5, "vip"], [3, "mid"], [3, "avg"]], [[4, "vip"], [3, "mid"], [2, "avg"]]],
  [[[4, "vip"], [2, "vip"], [1, "vip"]], [[5, "vip"], [1, "vip"], [4, "mid"]], [[5, "vip"], [3, "mid"], [2, "vip"]]],
  [[[3, "avg"], [4, "vip"], [2, "mid"]], [[3, "mid"], [4, "vip"], [3, "mid"]], [[5, "vip"], [1, "vip"], [3, "avg"]]],
];

/* =========================================================================
   2. DATOS MOCK
   ========================================================================= */
const INITIAL_ME = { name: "Alex", handle: "@alex", avatar: "🧑🏼", gradient: "from-pink-200 to-rose-100", score: 4.1, weight: 12, votes: 312 };

const person = (id, name, avatar, gradient, score) => ({ id, name, avatar, gradient, score, weight: 12, votes: 0 });
const INITIAL_USERS = {
  valentina: person("valentina", "Valentina Ríos", "👩🏼", "from-pink-200 to-amber-50", 4.8),
  marta: person("marta", "Marta Vidal", "👩🏻", "from-violet-100 to-pink-200", 4.7),
  diego: person("diego", "Diego Ferraz", "🧔🏻", "from-sky-100 to-pink-100", 4.4),
  jules: person("jules", "Jules Carter", "👩🏽", "from-rose-100 to-orange-50", 3.9),
  nico: person("nico", "Nico Bauer", "🧑🏼", "from-slate-200 to-pink-100", 3.1),
  omar: person("omar", "Omar Haddad", "👨🏻", "from-slate-200 to-slate-100", 2.6),
  rosa: person("rosa", "Rosa Medina", "👵🏼", "from-stone-200 to-slate-100", 1.4),
};

const POSTS = [
  { id: "p1", userId: "valentina", emoji: "☕", gradient: "from-amber-50 to-pink-100" },
  { id: "p2", userId: "marta", emoji: "🥐", gradient: "from-orange-50 to-rose-100" },
  { id: "p3", userId: "diego", emoji: "🏡", gradient: "from-sky-50 to-pink-100" },
  { id: "p4", userId: "jules", emoji: "🌷", gradient: "from-pink-50 to-violet-100" },
  { id: "p5", userId: "nico", emoji: "🍺", gradient: "from-slate-100 to-amber-50" },
  { id: "p6", userId: "omar", emoji: "💼", gradient: "from-slate-100 to-slate-200" },
  { id: "p7", userId: "rosa", emoji: "📵", gradient: "from-stone-100 to-sky-50" },
];

const VIP_BOTS = [
  { key: "aspirational", score: 4.9 },
  { key: "influencer", score: 4.8 },
  { key: "committee", score: 4.7 },
  { key: "corporate", score: 4.6 },
];
const RESENTFUL_BOTS = [
  { key: "resentful", score: 4.1 },
  { key: "classmate", score: 3.9 },
  { key: "envious", score: 3.7 },
  { key: "troll", score: 4.4 },
];
const SYSTEM = { key: "system", score: 5 };
const STRANGERS = ["airport", "cornerBarista", "rental", "coworker", "driver", "elevator"];

const PARANOIA = [
  { key: "boss" },
  { key: "whisper" },
  { key: "office" },
  { key: "ex" },
  { key: "valentina" },
  { key: "stranger", rating: { rater: { key: "stranger", score: 3.8 }, stars: 2, reason: "uncharismatic" } },
  { key: "barista", rating: { rater: { key: "barista", score: 3.6 }, stars: 3, reason: "forcedSmile" } },
  { key: "neighbor", rating: { rater: { key: "neighbor", score: 4.1 }, stars: 5, reason: "greeting" } },
];

const SERVICES = [
  { id: "cafe", icon: "☕", price: 4.5 },
  { id: "car", icon: "🚗", price: 85, restrictBelow: T.expensive },
  { id: "flight", icon: "✈️", price: 320, restrictBelow: T.warning },
  { id: "pearl", icon: "🏝️", price: 2400, eliteOnly: true },
];

/** Amigos simulados (se reemplazan por los reales al conectar el servidor). */
const FRIENDS = [
  { id: "sofi", name: "Sofi", avatar: "👧🏻", gradient: "from-pink-200 to-violet-100", records: { speedrun: 38200, climb: 71400, survival: 64800 } },
  { id: "mati", name: "Mati", avatar: "🧑🏽", gradient: "from-sky-100 to-pink-100", records: { speedrun: 29500, climb: null, survival: 92300 } },
  { id: "vale", name: "Vale", avatar: "👩🏼", gradient: "from-amber-50 to-pink-200", records: { speedrun: 51700, climb: 58900, survival: 47100 } },
  { id: "tomi", name: "Tomi", avatar: "🧑🏻", gradient: "from-slate-200 to-pink-100", records: { speedrun: 44100, climb: 96200, survival: 121000 } },
  { id: "cami", name: "Cami", avatar: "👩🏽", gradient: "from-rose-100 to-orange-50", records: { speedrun: null, climb: 63300, survival: 38600 } },
];

const HAPPY_WORDS = new Set([
  "feliz", "felices", "increible", "gracias", "amor", "genial", "perfecto", "perfecta", "maravilloso", "hermoso", "hermosa", "bendecida", "bendecido", "agradecida", "agradecido", "alegria",
  "happy", "amazing", "thanks", "thank", "grateful", "love", "blessed", "beautiful", "perfect", "wonderful", "awesome", "joy",
  "obrigada", "obrigado", "abencoada", "abencoado", "maravilhoso", "lindo", "linda", "incrivel", "amo", "gratidao", "perfeita", "alegria",
]);
const NEGATIVE_WORDS = new Set([
  "odio", "sistema", "cansado", "cansada", "feo", "fea", "triste", "asco", "horrible", "injusto", "harta", "harto", "basura", "mentira",
  "hate", "system", "tired", "ugly", "sad", "disgusting", "unfair", "sick", "trash", "lie", "lies",
  "odeio", "cansei", "feio", "feia", "nojo", "horrivel", "injusto", "lixo", "mentira", "raiva",
]);
/** Moderación: insultos que se ocultan con puntos antes de publicar. */
const INSULTS = new Set([
  "idiota", "estupido", "estupida", "imbecil", "tarado", "tarada", "pendejo", "pendeja", "weon", "weona", "huevon", "boludo", "boluda", "perdedor", "perdedora",
  "idiot", "stupid", "loser", "dumb", "moron", "freak",
  "burro", "burra", "otario", "otaria", "babaca", "trouxa",
]);

/* =========================================================================
   3. UTILIDADES
   ========================================================================= */
const cx = (...c) => c.filter(Boolean).join(" ");
const fmt = (n, d = 2) => Number(n).toFixed(d);
const round2 = (n) => Math.round(n * 100) / 100;
const normalize = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomStars = () => pick([1, 1, 2, 3, 3, 4, 4, 5, 5, 5]);
const money = (n, locale) => n.toLocaleString(locale, { style: "currency", currency: "USD", maximumFractionDigits: n < 10 ? 2 : 0 });
const fmtTime = (ms) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`);
const meta = () => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now() });

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const lastDays = (n) => Array.from({ length: n }, (_, i) => dateKey(new Date(Date.now() - i * 86400000)));
function dayNumber(d = new Date()) {
  const start = new Date(2026, 0, 1);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((today - start) / 86400000) + 1;
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const scenarioFor = (key) => hashStr(`xtats-${key}`) % DAILY_EFFECTS.length;

function analyzeText(text) {
  const tokens = normalize(text).match(/\p{L}+/gu) ?? [];
  return { happy: tokens.filter((w) => HAPPY_WORDS.has(w)), negative: tokens.filter((w) => NEGATIVE_WORDS.has(w)) };
}
function moderate(text) {
  let masked = false;
  const out = text.replace(/\p{L}+/gu, (w) => {
    if (!INSULTS.has(normalize(w))) return w;
    masked = true;
    return "•".repeat(w.length);
  });
  return { text: out, masked };
}

function isBetter(mode, a, b) {
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
function calculateXtatsScore(currentScore, totalVotes, starsGiven, raterScore) {
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

function rateWith(target, stars, raterScore) {
  const { score, newTotalVotes } = calculateXtatsScore(target.score, Math.min(target.weight, SOCIAL_MEMORY), stars, raterScore);
  return { ...target, score, weight: newTotalVotes, votes: (target.votes ?? 0) + 1 };
}

/** Puntaje del reto diario a partir de las opciones elegidas. */
function dailyOutcome(scenario, picks) {
  let p = { score: 4.1, weight: 12 };
  const stars = picks.map((opt, step) => {
    const [s, tier] = DAILY_EFFECTS[scenario][step][opt];
    p = rateWith(p, s, RATER_TIER[tier]);
    return s;
  });
  return { score: p.score, stars, grid: stars.map((s) => (s >= 4 ? "⭐" : s === 3 ? "🙂" : "💀")).join("") };
}

function influenceKey(score) {
  if (score >= 4.5) return { key: "vip", tone: "bg-pink-100 text-pink-500" };
  if (score >= 3.5) return { key: "mid", tone: "bg-rose-50 text-rose-400" };
  if (score >= 2.0) return { key: "avg", tone: "bg-slate-100 text-slate-500" };
  return { key: "pariah", tone: "bg-slate-200 text-slate-400" };
}
function impactKey(delta) {
  if (delta <= -0.25) return "drastic";
  if (delta < 0) return "down";
  if (delta === 0) return "same";
  return delta >= 0.15 ? "upMuch" : "up";
}
function scoreTone(score) {
  if (score >= T.elite) return "bg-pink-100 text-pink-500";
  if (score >= T.warning) return "bg-rose-50 text-rose-400";
  return "bg-slate-200 text-slate-500";
}
const nameOf = (who, t) => (who.key ? t.names[who.key] : who.name);

/* =========================================================================
   5. ESTADO (reducer puro) + PERSISTENCIA
   ========================================================================= */
function freshRun(mode, name) {
  const start = MODES[mode].start;
  const m = meta();
  return {
    me: { ...INITIAL_ME, name, handle: `@${normalize(name).replace(/[^a-z0-9]/g, "") || "alex"}`, score: start },
    users: structuredClone(INITIAL_USERS),
    rated: {},
    myPosts: [],
    cascade: false,
    history: [{ t: m.ts, s: start }],
    log: [{ ...m, tone: "neutral", type: "runStart" }],
    run: { mode, startedAt: m.ts, endedAt: null, outcome: null, time: null, newRecord: false },
  };
}

const initialState = () => ({
  profile: null,
  underage: false,
  ...freshRun("free", INITIAL_ME.name),
  records: { speedrun: null, climb: null, survival: null },
  days: {},
  daily: {},
  blocked: [],
  reported: [],
  sincere: [],
  inviteCode: `XT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const saved = JSON.parse(raw);
    if (!saved?.me || !saved?.run) return initialState();
    return { ...initialState(), ...saved };
  } catch {
    return initialState();
  }
}

const pushLog = (log, entry) => [entry, ...log].slice(0, MAX_LOG);
const bumpDay = (days, key, field, n = 1) => {
  const d = days[key] ?? { runs: 0, prisons: 0, elites: 0, posts: 0 };
  return { ...days, [key]: { ...d, [field]: (d[field] ?? 0) + n } };
};

function commitMe(state, me, entry) {
  const changed = me.score !== state.me.score;
  return {
    ...state,
    me,
    history: changed ? [...state.history, { t: entry.ts, s: me.score }].slice(-HISTORY_MAX) : state.history,
    log: pushLog(state.log, entry),
  };
}

function reducer(state, action) {
  const m = action.meta;
  switch (action.type) {
    case "ONBOARD":
      return { ...state, profile: { name: action.name }, ...freshRun("free", action.name), days: bumpDay(state.days, dateKey(), "runs") };

    case "UNDERAGE":
      return { ...state, underage: true };

    case "START_RUN":
      return { ...state, ...freshRun(action.mode, state.profile?.name ?? INITIAL_ME.name), days: bumpDay(state.days, dateKey(), "runs") };

    case "END_RUN": {
      if (state.run.endedAt) return state;
      const { mode, startedAt } = state.run;
      const time = action.now - startedAt;
      const counts = (mode === "speedrun" && action.outcome === "prison") || (mode === "climb" && action.outcome === "elite") || (mode === "survival" && action.outcome === "prison");
      const newRecord = counts && isBetter(mode, time, state.records[mode]);
      let days = state.days;
      if (action.outcome === "prison") days = bumpDay(days, dateKey(), "prisons");
      if (action.outcome === "elite") days = bumpDay(days, dateKey(), "elites");
      return {
        ...state,
        days,
        records: newRecord ? { ...state.records, [mode]: time } : state.records,
        run: { ...state.run, endedAt: action.now, outcome: action.outcome, time, newRecord, counts },
      };
    }

    case "DAY_INC":
      return { ...state, days: bumpDay(state.days, dateKey(), action.field) };

    case "RATE_POST": {
      const { postId, userId, stars } = action;
      if (state.rated[postId]) return state;
      const target = state.users[userId];
      const next = rateWith(target, stars, state.me.score);
      return {
        ...state,
        users: { ...state.users, [userId]: next },
        rated: { ...state.rated, [postId]: stars },
        log: pushLog(state.log, { ...m, tone: "neutral", type: "ratePost", p: { name: target.name, stars, from: target.score, to: next.score, ignored: next.score === target.score && state.me.score < 2 } }),
      };
    }

    case "RECEIVE_RATING": {
      const { rater, stars, reason } = action;
      const me = rateWith(state.me, stars, rater.score);
      const delta = round2(me.score - state.me.score);
      return commitMe(state, me, { ...m, tone: delta < 0 ? "down" : delta > 0 ? "up" : "neutral", type: "received", p: { rater, stars, reason, delta } });
    }

    case "PENALTY": {
      const me = { ...state.me, score: round2(Math.max(T.prison, state.me.score - action.amount)) };
      return commitMe(state, me, { ...m, tone: "down", type: "penalty", p: { amount: action.amount } });
    }

    case "PUBLISH": {
      const { text, happy, negative } = action;
      const post = { id: m.id, ts: m.ts, text, emoji: negative.length ? "🌧️" : happy.length ? "🌈" : "📝", gradient: negative.length ? "from-slate-200 to-slate-100" : "from-pink-100 to-amber-50" };
      return {
        ...state,
        myPosts: [post, ...state.myPosts].slice(0, 10),
        days: bumpDay(state.days, dateKey(), "posts"),
        log: pushLog(state.log, { ...m, tone: negative.length ? "down" : happy.length ? "up" : "neutral", type: "published", p: { text, happy, negative } }),
      };
    }

    case "SET_CASCADE":
      if (state.cascade === action.on) return state;
      return { ...state, cascade: action.on, log: pushLog(state.log, { ...m, tone: action.on ? "down" : "up", type: action.on ? "cascadeOn" : "cascadeOff" }) };

    case "LOG":
      return { ...state, log: pushLog(state.log, { ...m, tone: action.tone ?? "neutral", type: action.logType }) };

    case "DAILY_PICK": {
      const key = action.date;
      const cur = state.daily[key] ?? { scenario: action.scenario, picks: [] };
      if (cur.picks.length >= 3) return state;
      const picks = [...cur.picks, action.option];
      const done = picks.length === 3;
      return { ...state, daily: { ...state.daily, [key]: { ...cur, picks, done, ...(done ? dailyOutcome(cur.scenario, picks) : {}) } } };
    }

    case "BLOCK":
      return state.blocked.includes(action.userId) ? state : { ...state, blocked: [...state.blocked, action.userId] };
    case "UNBLOCK":
      return { ...state, blocked: state.blocked.filter((id) => id !== action.userId) };
    case "REPORT":
      return state.reported.includes(action.postId) ? state : { ...state, reported: [...state.reported, action.postId] };

    // Al iniciar sesión: trae del servidor los récords (gana el mejor) y el reto de hoy
    case "MERGE_REMOTE": {
      const records = { ...state.records };
      for (const r of action.records ?? []) if (isBetter(r.mode, r.ms, records[r.mode])) records[r.mode] = r.ms;
      let daily = state.daily;
      if (action.daily && !state.daily[action.day]?.done) {
        daily = { ...daily, [action.day]: { scenario: scenarioFor(action.day), picks: [], done: true, score: Number(action.daily.score), grid: action.daily.grid } };
      }
      return { ...state, records, daily };
    }

    case "SET_PHOTO":
      return state.profile ? { ...state, profile: { ...state.profile, photo: action.photo } } : state;

    case "SINCERE_POST":
      return { ...state, sincere: [{ id: m.id, ts: m.ts, text: action.text }, ...state.sincere].slice(0, 30) };

    case "WIPE":
      return initialState();

    default:
      return state;
  }
}

function logText(e, t) {
  const L = t.log;
  const p = e.p ?? {};
  switch (e.type) {
    case "ratePost":
      return L.ratePost({ ...p, from: fmt(p.from), to: fmt(p.to) });
    case "received":
      return L.received({ rater: nameOf(p.rater, t), score: fmt(p.rater.score, 1), stars: p.stars, reason: p.reason ? t.reasons[p.reason] : "", impact: t.impact[impactKey(p.delta)], pariah: p.rater.score < 2 });
    case "penalty":
      return L.penalty({ amount: fmt(p.amount) });
    case "published": {
      const short = p.text.length > 40 ? `${p.text.slice(0, 40)}…` : p.text;
      const verdict = p.negative.length ? L.verdictNeg(p.negative.join(", ")) : p.happy.length ? L.verdictHappy(p.happy.join(", ")) : L.verdictNeutral;
      return L.published({ text: short, verdict });
    }
    default:
      return L[e.type] ?? "";
  }
}

/* ---------- Datos de demo (se usan cuando no hay sesión de Supabase) ---------- */
const backend = {
  /** Amigos del grupo con sus récords (simulados en la demo). */
  getFriends: () => FRIENDS,
  /** Puntajes del reto diario de los amigos para una fecha (simulados con semilla). */
  getFriendsDaily: (key) => {
    const rnd = seeded(hashStr(`friends-${key}`));
    return FRIENDS.map((f) => ({ ...f, score: round2(1.6 + rnd() * 3.3) }));
  },
};

/* ---------- Métricas locales (embudo de compartir) ---------- */
function useMetrics() {
  const [metrics, setMetrics] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(METRICS_KEY)) ?? {};
    } catch {
      return {};
    }
  });
  const track = useCallback((k) => {
    setMetrics((prev) => {
      const next = { ...prev, [k]: (prev[k] ?? 0) + 1 };
      try {
        localStorage.setItem(METRICS_KEY, JSON.stringify(next));
      } catch {
        /* sin almacenamiento */
      }
      return next;
    });
  }, []);
  return [metrics, track];
}

/* =========================================================================
   6. AUDIO Y VIBRACIÓN
   ========================================================================= */
const vibrate = (pattern) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no soportado */
  }
};

function useSynth(enabledRef) {
  const ctxRef = useRef(null);
  const getCtx = useCallback(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctxRef.current) ctxRef.current = new AC();
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const voice = (ctx, { freq, to, type = "sine", start = 0, dur = 0.5, gain = 0.1, attack = 0.01, lowpass }) => {
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc.connect(g);
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lowpass;
      node = node.connect(f);
    }
    node.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  };
  const ready = () => (enabledRef.current ? getCtx() : null);

  // Arpa ascendente (4–5★) — sonido "firma" de XTATS
  const playHarp = useCallback(() => {
    vibrate(12);
    const ctx = ready();
    if (!ctx) return;
    [523.3, 659.3, 784, 1046.5, 1318.5].forEach((freq, i) => {
      voice(ctx, { freq, type: "triangle", start: i * 0.06, dur: 0.9, gain: 0.07, attack: 0.005 });
      voice(ctx, { freq: freq * 2, start: i * 0.06, dur: 0.4, gain: 0.012, attack: 0.005 });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Golpe grave y sordo (1–2★)
  const playThud = useCallback(() => {
    vibrate([40, 30, 40]);
    const ctx = ready();
    if (!ctx) return;
    voice(ctx, { freq: 98, to: 55, type: "sawtooth", dur: 0.6, gain: 0.08, lowpass: 320 });
    voice(ctx, { freq: 103.8, to: 58, type: "square", dur: 0.6, gain: 0.04, lowpass: 260 });
    voice(ctx, { freq: 49, to: 36, dur: 0.7, gain: 0.14 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Error del Modo Prisión
  const playError = useCallback(() => {
    vibrate([200, 80, 400]);
    const ctx = ready();
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const noise = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = 0.12;
    noise.buffer = buffer;
    noise.connect(g).connect(ctx.destination);
    noise.start();
    voice(ctx, { freq: 180, to: 40, type: "square", dur: 0.3, gain: 0.12 });
    voice(ctx, { freq: 46, type: "sawtooth", start: 0.25, dur: 2.6, gain: 0.06, lowpass: 400 });
    voice(ctx, { freq: 48.7, type: "sawtooth", start: 0.25, dur: 2.6, gain: 0.05, lowpass: 400 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { unlock: getCtx, playHarp, playThud, playError };
}

/* =========================================================================
   7. TARJETAS 9:16 (canvas)
   ========================================================================= */
const CARD_W = 1080;
const CARD_H = 1920;
const FONT = "Manrope, ui-sans-serif, system-ui, sans-serif";

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function newCard() {
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

function cardText(ctx, text, y, { size = 40, weight = 400, color = "#475569", max = 900 } = {}) {
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

function cardFooter(ctx, t) {
  cardText(ctx, t.card.footer, CARD_H - 110, { size: 34, color: "#94a3b8" });
}

function drawCurve(ctx, history, x, y, w, h) {
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
function renderRunCard({ t, name, mode, outcome, time, score, history }) {
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

function runHeadline(t, mode, outcome, time, score) {
  if (outcome === "prison") return mode === "speedrun" ? t.card.prisonLine(fmtTime(time)) : mode === "survival" ? t.card.survivedLine(fmtTime(time)) : t.card.prisonFreeLine;
  if (outcome === "elite") return t.card.eliteLine(fmtTime(time));
  if (outcome === "timeout") return t.card.timeoutLine;
  return t.card.freeLine(fmt(score));
}

/** Tarjeta del reto diario: puntaje y cuadrícula de emojis. */
function renderDailyCard({ t, n, title, score, grid }) {
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
function renderWeekCard({ t, name, rows }) {
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
function composePhoto({ source, sw, sh, mirror, headY, name, score }) {
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
function fileToSquareJpeg(file, size = 320) {
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

/** "2 d 4 h", "5 h 12 min", "12 min". */
function fmtLeft(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m % 60} min` : `${m} min`;
}

function dataUrlToBlob(url) {
  const [head, body] = url.split(",");
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/* =========================================================================
   8. COMPONENTES
   ========================================================================= */
const S = {
  card: "rounded-3xl bg-white/80 backdrop-blur ring-1 ring-pink-100 shadow-[0_10px_30px_-12px_rgba(236,72,153,0.25)]",
  btn: "w-full rounded-2xl px-4 py-3 text-sm font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300",
  btnPrimary: "bg-gradient-to-r from-pink-300 to-rose-300 text-white shadow-md shadow-pink-200 hover:brightness-105",
  btnGhost: "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50",
  btnDanger: "bg-slate-100 text-slate-500 ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-400",
  avatar: "grid shrink-0 place-items-center rounded-full bg-gradient-to-br ring-2 ring-white",
  pill: "rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
  label: "text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400",
  muted: "text-xs text-slate-400",
  field: "w-full rounded-2xl bg-white/90 text-sm text-slate-600 placeholder:text-slate-300 ring-1 ring-pink-100 outline-none transition focus:ring-2 focus:ring-pink-200",
  overlay: "absolute inset-0 flex flex-col items-center justify-center px-8 text-center",
  seg: "rounded-full px-3 py-1 text-xs font-medium transition",
};

/** Contexto compartido: idioma, toasts, sonido y métricas. */
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

function Logo() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-gradient-to-br from-pink-300 to-rose-400" />
      <span className="text-sm font-light tracking-[0.45em] text-slate-600">XTATS</span>
    </div>
  );
}

function LangSwitch({ lang, onChange }) {
  const { t } = useApp();
  return (
    <div role="group" aria-label={t.langAria} className="flex rounded-full bg-white/80 p-0.5 ring-1 ring-pink-100">
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          aria-pressed={lang === code}
          className={cx("rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider transition", lang === code ? "bg-pink-300 text-white" : "text-slate-400 hover:text-slate-600")}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Avatar({ person: p, size = "h-10 w-10 text-xl" }) {
  return <div className={cx(S.avatar, p.gradient, size, "overflow-hidden")}>{p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : p.avatar}</div>;
}

/** Botón de acceso con el ícono oficial de Google o Facebook (react-icons). */
const PROVIDER_ICON = { google: FcGoogle, facebook: FaFacebook };
function ProviderButton({ provider, label, onClick, disabled, compact }) {
  const Icon = PROVIDER_ICON[provider];
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cx(S.btn, S.btnGhost, "flex items-center justify-center gap-2", compact && "py-2")}>
      <Icon aria-hidden="true" className={cx("h-5 w-5 shrink-0", provider === "facebook" && "text-[#1877F2]")} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function ScorePill({ score }) {
  return <span className={cx(S.pill, scoreTone(score))}>★ {fmt(score)}</span>;
}

function StarRating({ value = 0, onRate, disabled }) {
  const { t } = useApp();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onMouseEnter={() => !disabled && setHover(n)}
          onClick={() => onRate(n)}
          aria-label={t.starsAria(n)}
          className={cx("text-2xl leading-none transition", n <= shown ? "text-pink-300 drop-shadow-[0_0_6px_rgba(249,168,212,0.8)]" : "text-slate-200", disabled ? "cursor-default" : "hover:scale-125")}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function PostCard({ post, text, author, time, myRating, onRate, isOwn, onReport, onBlock }) {
  const { t } = useApp();
  const [menu, setMenu] = useState(false);
  return (
    <article className={cx(S.card, "nd-pop relative overflow-hidden")}>
      <header className="flex items-center gap-3 p-4">
        <Avatar person={author} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-700">{author.name}</p>
          <p className={S.muted}>{time}</p>
        </div>
        <ScorePill score={author.score} />
        {!isOwn && (
          <button type="button" onClick={() => setMenu((v) => !v)} aria-label={t.postMenu.open} aria-expanded={menu} className="rounded-full px-1.5 text-lg leading-none text-slate-300 hover:text-slate-500">
            ⋯
          </button>
        )}
      </header>
      {menu && (
        <div className="absolute right-4 top-14 z-10 overflow-hidden rounded-2xl bg-white text-sm shadow-lg ring-1 ring-slate-100">
          <button type="button" onClick={() => (setMenu(false), onReport())} className="block w-full px-4 py-2 text-left text-slate-600 hover:bg-rose-50">
            {t.postMenu.report}
          </button>
          <button type="button" onClick={() => (setMenu(false), onBlock())} className="block w-full px-4 py-2 text-left text-rose-400 hover:bg-rose-50">
            {t.postMenu.block}
          </button>
        </div>
      )}
      <div className={cx("mx-4 grid aspect-[4/3] max-w-full place-items-center rounded-2xl bg-gradient-to-br text-7xl", post.gradient)}>{post.emoji}</div>
      <p className="px-4 pt-3 text-sm text-slate-600">{text}</p>
      <footer className="flex items-center justify-between px-4 py-3">
        {isOwn ? (
          <span className={S.muted}>{t.ownPost}</span>
        ) : (
          <>
            <StarRating value={myRating} disabled={!!myRating} onRate={onRate} />
            <span className={S.muted}>{myRating ? t.rated : t.rate}</span>
          </>
        )}
      </footer>
    </article>
  );
}

function Composer({ onPublish }) {
  const { t } = useApp();
  const [text, setText] = useState("");
  const { happy, negative } = useMemo(() => analyzeText(text), [text]);
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onPublish(text.trim());
    setText("");
  };
  return (
    <form onSubmit={submit} className={cx(S.card, "space-y-3 p-4")}>
      <label htmlFor="xt-status" className={S.label}>
        {t.composerLabel}
      </label>
      <textarea id="xt-status" value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={t.composerPh} className={cx(S.field, "resize-none p-3")} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {happy.length > 0 && <span className={cx(S.pill, "bg-pink-50 text-pink-400")}>{t.chipHappy(happy.length)}</span>}
          {negative.length > 0 && <span className={cx(S.pill, "nd-shake bg-slate-200 text-slate-500")}>{t.chipNeg(negative.length)}</span>}
        </div>
        <button type="submit" disabled={!text.trim()} className={cx(S.btn, S.btnPrimary, "w-auto px-5 py-2")}>
          {t.publish}
        </button>
      </div>
    </form>
  );
}

function TrendChart({ history, votes }) {
  const { t } = useApp();
  const W = 300;
  const H = 96;
  const P = 6;
  const pts = history.length > 1 ? history : [history[0], history[0]];
  const x = (i) => P + (i * (W - 2 * P)) / (pts.length - 1);
  const y = (s) => P + ((5 - s) * (H - 2 * P)) / 4.9;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.s).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
  const last = pts[pts.length - 1].s;
  const delta = round2(last - pts[Math.max(0, pts.length - 6)].s);
  const status = delta <= -0.3 ? { key: "freefall", tone: "bg-slate-600 text-white nd-blink" } : delta >= 0.2 ? { key: "rising", tone: "bg-pink-100 text-pink-500" } : { key: "stable", tone: "bg-rose-50 text-rose-400" };
  const all = pts.map((p) => p.s);
  return (
    <section className={cx(S.card, "p-4")}>
      <div className="mb-2 flex items-center justify-between">
        <p className={S.label}>{t.trendLabel}</p>
        <span className={cx(S.pill, status.tone)}>{t.trend[status.key]}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-label={t.chartAria}>
        <defs>
          <linearGradient id="xt-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: "rgb(var(--c-pink-300))", stopOpacity: 0.45 }} />
            <stop offset="100%" style={{ stopColor: "rgb(var(--c-pink-300))", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {[T.elite, T.warning, T.locked].map((v) => (
          <g key={v}>
            <line x1={P} x2={W - P} y1={y(v)} y2={y(v)} style={{ stroke: "rgb(var(--c-slate-300))" }} strokeDasharray="3 4" strokeWidth="1" />
            <text x={W - P} y={y(v) - 2} textAnchor="end" fontSize="8" style={{ fill: "rgb(var(--c-slate-400))" }}>
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#xt-area)" />
        <path d={line} fill="none" style={{ stroke: "rgb(var(--c-pink-400))" }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(pts.length - 1)} cy={y(last)} r="3.5" style={{ fill: "rgb(var(--c-pink-400))" }} className="nd-blink" />
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {[
          [t.max, fmt(Math.max(...all))],
          [t.min, fmt(Math.min(...all))],
          [t.votes, votes],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-rose-50/60 py-2">
            <p className={S.label}>{k}</p>
            <p className="text-sm tabular-nums text-slate-600">{v}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Services({ score }) {
  const { t } = useApp();
  const expensive = score < T.expensive;
  const elite = score > T.elite;
  return (
    <section className={cx(S.card, "p-4")}>
      <div className="mb-3 flex items-center justify-between">
        <p className={S.label}>{t.servicesLabel}</p>
        {expensive && <span className={cx(S.pill, "bg-slate-600 text-white")}>{t.riskRate}</span>}
      </div>
      <ul className="space-y-2">
        {SERVICES.map((s) => {
          const restricted = (s.restrictBelow && score < s.restrictBelow) || (s.eliteOnly && !elite);
          const price = expensive ? s.price * 5 : s.price;
          return (
            <li key={s.id} className={cx("flex items-center gap-3 rounded-2xl px-3 py-2", restricted ? "bg-slate-100/80" : "bg-rose-50/50")}>
              <span className={cx("text-xl", restricted && "grayscale")}>{s.icon}</span>
              <div className="min-w-0 flex-1">
                <p className={cx("truncate text-sm", restricted ? "text-slate-400" : "text-slate-600")}>{t.services[s.id]}</p>
                {restricted && <p className="text-[10px] text-slate-400">{s.eliteOnly ? t.requires(T.elite.toFixed(1)) : t.restricted}</p>}
                {s.eliteOnly && elite && <p className="text-[10px] text-pink-400">{t.eliteUnlocked}</p>}
              </div>
              <div className="text-right tabular-nums">
                {expensive && <p className="text-[10px] text-slate-300 line-through">{money(s.price, t.locale)}</p>}
                <p className={cx("text-sm", expensive ? "font-medium text-slate-600" : "text-slate-500")}>{money(price, t.locale)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ActivityLog({ entries }) {
  const { t } = useApp();
  const dot = { up: "bg-pink-300", down: "bg-slate-400", neutral: "bg-rose-100" };
  return (
    <section className={cx(S.card, "p-4")}>
      <p className={cx(S.label, "mb-3")}>{t.historyLabel}</p>
      {entries.length === 0 ? (
        <p className={S.muted}>{t.historyEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="nd-pop flex gap-3">
              <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot[e.tone])} />
              <div className="min-w-0">
                <p className={cx("text-xs leading-snug", e.tone === "down" ? "text-slate-500" : "text-slate-600")}>{logText(e, t)}</p>
                <p className="mt-0.5 text-[10px] text-slate-300">{new Date(e.ts).toLocaleTimeString(t.locale)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Toasts({ items }) {
  const { t } = useApp();
  const tone = { alert: "bg-white/95 text-slate-600 ring-pink-100", danger: "bg-slate-700/95 text-white ring-slate-600", good: "bg-pink-50/95 text-pink-500 ring-pink-200" };
  return (
    <div className="pointer-events-none absolute inset-x-3 top-11 z-[56] space-y-2" aria-live="polite">
      {items.map((x) => (
        <div key={x.id} className={cx("nd-toast rounded-2xl px-4 py-2.5 text-xs shadow-lg ring-1 backdrop-blur", tone[x.tone])}>
          <span className="font-semibold tracking-wide">[XTATS Alert] </span>
          {t[x.group][x.key]}
        </div>
      ))}
    </div>
  );
}

function SuccessOverlay() {
  const { t } = useApp();
  return (
    <div className={cx(S.overlay, "pointer-events-none z-50")}>
      <div className="nd-pop relative rounded-3xl bg-white/95 p-6 shadow-2xl shadow-pink-200 ring-1 ring-pink-100">
        {["✨", "🌸", "⭐", "💗", "✨", "🌷"].map((s, i) => (
          <span key={i} className="nd-float absolute text-xl" style={{ left: `${10 + i * 15}%`, top: "40%", animationDelay: `${i * 0.12}s` }}>
            {s}
          </span>
        ))}
        <p className="text-4xl">🏝️</p>
        <p className="mt-3 text-base font-medium text-pink-500">{t.elite.title}</p>
        <p className="mt-1 text-sm text-slate-500">{t.elite.body}</p>
      </div>
    </div>
  );
}

function LockScreen({ score }) {
  const { t } = useApp();
  return (
    <div className={cx(S.overlay, "z-[52] bg-slate-200/95 backdrop-blur-md")}>
      <div className="nd-shake grid h-20 w-20 place-items-center rounded-full bg-slate-300 text-4xl">🔒</div>
      <p className={cx(S.label, "mt-6")}>{t.lock.label}</p>
      <h2 className="mt-2 text-xl font-medium text-slate-600">{t.lock.title}</h2>
      <p className="mt-1 text-sm text-slate-500">{t.lock.sub}</p>
      <p key={score} className="nd-shake mt-6 text-5xl font-light tabular-nums text-slate-500">
        {fmt(score)}
      </p>
      <p className="nd-blink mt-6 text-xs text-slate-400">{t.lock.note}</p>
    </div>
  );
}

/** Modo Prisión: glitch, oscuridad, y la salida hacia el Modo Sincero. */
function PrisonScreen({ run, records, onRestart, onSincere, onShare }) {
  const { t } = useApp();
  const showTime = run.mode === "speedrun" || run.mode === "survival";
  return (
    <div data-skin="pink" className={cx(S.overlay, "nd-glitch-in z-[53] bg-slate-950 text-slate-300")}>
      <div className="nd-scanlines pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(244,63,94,0.18),transparent_60%)]" />
      <div className="relative z-30 w-full rounded-3xl bg-slate-950/90 px-6 py-8">
        <p className="nd-blink font-mono text-[10px] tracking-[0.4em] text-rose-400/80">{t.prison.error}</p>
        <h2 className="nd-glitch mt-4 font-mono text-2xl tracking-wider text-slate-100">{t.prison.title}</h2>
        <p className="mt-3 font-mono text-xs leading-relaxed text-slate-500">
          {t.prison.l1}
          <br />
          {t.prison.l2}
        </p>
        <p className="mt-6 font-mono text-6xl font-light text-rose-400">{fmt(T.prison)}</p>
        {showTime && (
          <div className="mt-4 font-mono text-xs text-slate-400">
            <p>{run.mode === "survival" ? t.result.survived(fmtTime(run.time)) : t.result.time(fmtTime(run.time))}</p>
            <p className={run.newRecord ? "text-pink-300" : ""}>{run.newRecord ? t.result.newRecord : t.result.record(fmtTime(records[run.mode]))}</p>
          </div>
        )}
        <div className="mt-6 grid gap-2">
          <button onClick={onSincere} className="rounded-xl bg-slate-100 px-6 py-3 font-mono text-sm text-slate-900 transition hover:bg-white">
            {t.prison.sincere}
          </button>
          <button onClick={onShare} className="rounded-xl border border-slate-600 px-6 py-3 font-mono text-sm text-slate-200 transition hover:border-pink-300 hover:text-pink-200">
            {t.prison.share}
          </button>
          <button onClick={onRestart} className="rounded-xl border border-slate-700 px-6 py-3 font-mono text-sm text-slate-400 transition hover:border-rose-400 hover:text-rose-300">
            {t.prison.restart}
          </button>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 z-20" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 38px, rgba(100,116,139,.45) 38px 44px, rgba(30,41,59,.85) 44px 46px)" }} />
    </div>
  );
}

/** Modo Sincero: sin filtro, sin puntaje, sin consecuencias. */
function SincereScreen({ posts, onPost, onExit }) {
  const { t, pushToast } = useApp();
  const [text, setText] = useState("");
  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const mod = moderate(text.trim());
    if (mod.masked) pushToast("toast", "moderated", "alert");
    onPost(mod.text);
    setText("");
  };
  return (
    <div data-skin="pink" className="absolute inset-0 z-[54] overflow-y-auto bg-white text-neutral-900" style={{ fontFamily: "ui-sans-serif, Helvetica, Arial, sans-serif" }}>
      <div className="space-y-6 px-6 pb-10 pt-12">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">XTATS · 0.1</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">{t.sincere.title}</h2>
          <p className="mt-1 text-sm font-semibold">{t.sincere.sub}</p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">{t.sincere.body}</p>
        </div>
        <form onSubmit={submit} className="space-y-2">
          <label htmlFor="xt-sincere" className="sr-only">
            {t.sincere.ph}
          </label>
          <textarea id="xt-sincere" value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={t.sincere.ph} className="w-full resize-none border-2 border-neutral-900 p-3 text-sm outline-none focus:bg-neutral-50" />
          <button type="submit" disabled={!text.trim()} className="w-full bg-neutral-900 py-3 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-40">
            {t.sincere.post}
          </button>
        </form>
        <ul className="space-y-3">
          {posts.length === 0 && <li className="text-sm text-neutral-400">{t.sincere.empty}</li>}
          {posts.map((p) => (
            <li key={p.id} className="border-l-4 border-neutral-900 pl-3">
              <p className="whitespace-pre-wrap break-words text-base font-medium">{p.text}</p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-neutral-400">{new Date(p.ts).toLocaleString(t.locale)}</p>
            </li>
          ))}
        </ul>
        <button onClick={onExit} className="w-full border-2 border-neutral-900 py-3 text-sm font-bold uppercase tracking-widest">
          {t.sincere.exit}
        </button>
      </div>
    </div>
  );
}

/** Resultado del Contrarreloj 4.5 (llegaste o se acabó el tiempo). */
function RunResult({ run, records, onAgain, onShare, onHome }) {
  const { t } = useApp();
  const won = run.outcome === "elite";
  return (
    <div className={cx(S.overlay, "z-[51] bg-white/70 backdrop-blur-sm")}>
      <div className="nd-pop w-full rounded-3xl bg-white p-6 shadow-2xl shadow-pink-200 ring-1 ring-pink-100">
        <p className="text-4xl">{won ? "🥂" : "⌛"}</p>
        <h2 className="mt-3 text-lg font-medium text-slate-700">{won ? t.result.eliteTitle : t.result.timeoutTitle}</h2>
        {!won && <p className="mt-1 text-sm text-slate-500">{t.result.timeoutBody}</p>}
        {won && (
          <div className="mt-2 text-sm tabular-nums text-slate-500">
            <p>{t.result.time(fmtTime(run.time))}</p>
            <p className={run.newRecord ? "font-medium text-pink-500" : ""}>{run.newRecord ? t.result.newRecord : t.result.record(fmtTime(records.climb))}</p>
          </div>
        )}
        <div className="mt-5 grid gap-2">
          <button onClick={onShare} className={cx(S.btn, S.btnPrimary)}>
            {t.result.share}
          </button>
          <button onClick={onAgain} className={cx(S.btn, S.btnGhost)}>
            {t.result.playAgain}
          </button>
          <button onClick={onHome} className="py-2 text-xs text-slate-400 hover:text-slate-600">
            {t.result.home}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Barra del modo actual con reloj y récord. */
function ModeBar({ run, records, onChange, onHelp }) {
  const { t } = useApp();
  const [now, setNow] = useState(Date.now());
  const active = !run.endedAt;
  useEffect(() => {
    if (!active || run.mode === "free") return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [active, run.mode]);
  const elapsed = (active ? now : run.endedAt) - run.startedAt;
  const limit = MODES[run.mode].limitMs;
  const clock = run.mode === "free" ? null : limit ? fmtTime(Math.max(0, limit - elapsed)) : fmtTime(elapsed);
  return (
    <section className={cx(S.card, "flex items-center gap-3 px-4 py-3")}>
      <div className="min-w-0 flex-1">
        <p className={S.label}>{t.modes[run.mode].name}</p>
        <p className="truncate text-xs text-slate-500">
          {RECORD_MODES.includes(run.mode) ? `${t.modeBar.best}: ${fmtTime(records[run.mode])}` : t.modes[run.mode].desc}
        </p>
      </div>
      {clock && <span className={cx("font-mono text-lg tabular-nums", limit && limit - elapsed < 20000 ? "nd-blink text-rose-400" : "text-slate-600")}>{clock}</span>}
      <button type="button" onClick={onHelp} aria-label={t.howto.open} title={t.howto.open} className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-semibold text-slate-400 ring-1 ring-slate-200 hover:text-pink-500">
        ?
      </button>
      <button type="button" onClick={onChange} className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-pink-500 ring-1 ring-pink-100 hover:bg-pink-100">
        {t.modeBar.change}
      </button>
    </section>
  );
}

/** Hoja para elegir modo de juego. */
function ModePicker({ records, onPick, onClose, onHelp }) {
  const { t } = useApp();
  return (
    <div className="absolute inset-0 z-[57] flex flex-col justify-end bg-slate-900/20 backdrop-blur-[2px]" onClick={onClose}>
      <div className="nd-sheet space-y-3 rounded-t-[2rem] bg-white p-5 pb-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" />
        <div className="flex items-center justify-between">
          <p className={S.label}>{t.modeBar.pick}</p>
          <button type="button" onClick={onHelp} className="text-xs font-medium text-pink-500 hover:text-pink-600">
            {t.howto.open} →
          </button>
        </div>
        {MODE_ORDER.map((mode) => (
          <button key={mode} type="button" onClick={() => onPick(mode)} className="flex w-full items-center gap-3 rounded-2xl bg-rose-50/60 p-4 text-left ring-1 ring-pink-100 transition hover:bg-pink-50">
            <span className="text-2xl">{MODE_ICON[mode]}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-700">{t.modes[mode].name}</span>
              <span className="block text-xs text-slate-400">{t.modes[mode].desc}</span>
            </span>
            {RECORD_MODES.includes(mode) && <span className="text-xs tabular-nums text-pink-400">{fmtTime(records[mode])}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Guía "Cómo se juega": reglas básicas y qué significa cada modo. */
function HowToSheet({ current, onClose }) {
  const { t } = useApp();
  const H = t.howto;
  return (
    <div className="absolute inset-0 z-[58] flex flex-col justify-end bg-slate-900/20 backdrop-blur-[2px]" onClick={onClose}>
      <div className="nd-sheet max-h-[90%] space-y-5 overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" />
        <h2 className="text-lg font-medium text-slate-700">{H.title}</h2>

        <section className="space-y-2">
          <p className={S.label}>{H.modesLabel}</p>
          {MODE_ORDER.map((mode) => {
            const m = H.modes[mode];
            return (
              <article key={mode} className={cx("space-y-2 rounded-2xl p-4 ring-1", mode === current ? "bg-pink-50 ring-pink-200" : "bg-rose-50/40 ring-pink-100")}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{MODE_ICON[mode]}</span>
                  <h3 className="text-sm font-semibold text-slate-700">{t.modes[mode].name}</h3>
                </div>
                <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1.5 text-xs leading-relaxed">
                  {[
                    [H.goal, m.goal],
                    [H.win, m.win],
                    [H.record, m.record],
                    [H.tip, m.tip],
                  ].map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-medium text-slate-400">{k}</dt>
                      <dd className="min-w-0 text-slate-600">{v}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            );
          })}
        </section>

        <section className="space-y-2">
          <p className={S.label}>{H.basicsLabel}</p>
          <dl className="divide-y divide-rose-50 rounded-2xl bg-rose-50/40 px-4 ring-1 ring-pink-100">
            {H.basics.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-2 py-2.5 text-xs leading-relaxed">
                <dt className="font-semibold text-slate-600">{k}</dt>
                <dd className="min-w-0 text-slate-500">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <button onClick={onClose} className={cx(S.btn, S.btnPrimary)}>
          {H.close}
        </button>
      </div>
    </div>
  );
}

/** Hoja de cuenta: quién eres, conectar Google/Meta y cerrar sesión. */
function AccountSheet({ name, email, provider, photo, skin, onSkin, onPhoto, onClose }) {
  const { t, userId, login, logout, cloud, pushToast } = useApp();
  const [busy, setBusy] = useState(false);
  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await onPhoto(await fileToSquareJpeg(file));
    } catch {
      pushToast("toast", "photoFailed", "danger");
    } finally {
      setBusy(false);
    }
  };
  const meCard = { avatar: (name || "?").slice(0, 1).toUpperCase(), gradient: "from-pink-200 to-rose-100", photo };
  const swatches = { pink: ["#fdf7f9", "#f472b6", "#334155"], black: ["#040605", "#39ff14", "#00f0ff"], white: ["#ffffff", "#1d9bf0", "#0f1419"] };
  return (
    <div className="absolute inset-0 z-[57] flex flex-col justify-end bg-slate-900/20 backdrop-blur-[2px]" onClick={onClose}>
      <div className="nd-sheet max-h-[92%] space-y-4 overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" />
        <p className={S.label}>{t.account.title}</p>

        <div className="flex items-center gap-3 rounded-2xl bg-rose-50/60 p-3">
          <Avatar person={meCard} size="h-16 w-16 text-2xl font-semibold text-pink-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-700">{name}</p>
            <p className="truncate text-xs text-slate-400">
              {userId ? `${t.account.signedInWith(provider === "facebook" ? "Facebook" : "Google")}${email ? ` · ${email}` : ""}` : t.account.guest}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className={cx("cursor-pointer rounded-full bg-pink-300 px-3 py-1 text-xs font-medium text-white", busy && "opacity-60")}>
                {busy ? t.photo.uploading : photo ? t.photo.change : t.photo.add}
                <input id="xt-photo" type="file" accept="image/*" onChange={pickPhoto} disabled={busy} className="sr-only" />
              </label>
              {photo && !busy && (
                <button type="button" onClick={() => onPhoto(null)} className="rounded-full px-3 py-1 text-xs text-slate-400 ring-1 ring-slate-200 hover:text-rose-500">
                  {t.photo.remove}
                </button>
              )}
            </div>
          </div>
        </div>

        {userId && cloud.profile?.score != null && (
          <div className="flex items-center justify-between gap-3 rounded-2xl px-1">
            <div>
              <p className={S.label}>{t.social.label}</p>
              <p className="text-[11px] leading-snug text-slate-400">{t.social.hint}</p>
            </div>
            <p className="text-3xl font-extralight tabular-nums text-pink-400">{fmt(cloud.profile.score)}</p>
          </div>
        )}

        <div className="space-y-2">
          <p className={S.label}>{t.skins.label}</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.skins.label}>
            {SKINS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={skin === k}
                onClick={() => onSkin(k)}
                className={cx("space-y-1.5 rounded-2xl p-2 text-left ring-1 transition", skin === k ? "ring-2 ring-pink-400" : "ring-slate-200 hover:ring-pink-200")}
              >
                <span className="flex h-10 items-center justify-center gap-1 rounded-xl" style={{ background: swatches[k][0], boxShadow: "inset 0 0 0 1px rgba(127,127,127,.25)" }}>
                  <span className="h-3 w-3 rounded-full" style={{ background: swatches[k][1] }} />
                  <span className="h-1.5 w-6 rounded-full" style={{ background: swatches[k][2] }} />
                </span>
                <span className="block text-xs font-semibold text-slate-700">{t.skins[k]}</span>
                <span className="block text-[10px] leading-tight text-slate-400">{t.skins[`${k}Desc`]}</span>
              </button>
            ))}
          </div>
        </div>

        {!userId && remote.enabled && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">{t.account.connect}</p>
            <div className="grid grid-cols-2 gap-2">
              <ProviderButton provider="google" label="Google" compact onClick={() => login("google", name)} />
              <ProviderButton provider="facebook" label="Facebook" compact onClick={() => login("facebook", name)} />
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <button onClick={logout} className={cx(S.btn, S.btnDanger)}>
            {userId ? t.account.signOut : t.account.leaveGuest}
          </button>
          <p className="text-center text-[10px] leading-relaxed text-slate-400">{userId ? t.account.signOutHint : t.account.leaveGuestHint}</p>
        </div>
        <button onClick={onClose} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600">
          {t.account.close}
        </button>
      </div>
    </div>
  );
}

/* ---------- Retos personalizados ---------- */
const STATUS_TONE = {
  pending: "bg-amber-50 text-amber-600",
  accepted: "bg-pink-100 text-pink-600",
  claimed: "bg-sky-100 text-sky-700",
  completed: "bg-pink-300 text-white",
  failed: "bg-slate-600 text-white",
  declined: "bg-slate-100 text-slate-400",
  expired: "bg-slate-100 text-slate-400",
};
const UNKNOWN_PERSON = { name: "…", avatar: "?", gradient: "from-slate-100 to-slate-200" };

function TimeLeft({ deadline }) {
  const { t } = useApp();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const ms = new Date(deadline).getTime() - now;
  return <span className={cx("text-[11px] tabular-nums", ms > 0 && ms < 3600000 ? "text-rose-500" : "text-slate-400")}>{ms <= 0 ? t.challenges.ended : t.challenges.left(fmtLeft(ms))}</span>;
}

function ReceivedCard({ c, sender = UNKNOWN_PERSON, onAction }) {
  const { t } = useApp();
  const C = t.challenges;
  const st = c.mine.status;
  const open = new Date(c.deadline).getTime() > Date.now();
  return (
    <article className={cx(S.card, "space-y-3 p-4")}>
      <header className="flex items-start gap-3">
        <Avatar person={sender} size="h-9 w-9 text-base" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-slate-400">
            {C.from(sender.name)}
            {sender.xscore != null && ` · ★ ${fmt(sender.xscore)}`}
          </p>
          <h3 className="break-words text-sm font-semibold text-slate-700">{c.title}</h3>
        </div>
        <span className={cx(S.pill, "shrink-0", STATUS_TONE[st])}>{C.status[st]}</span>
      </header>
      {c.details && <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{c.details}</p>}
      <div className="flex items-center justify-between gap-2">
        <TimeLeft deadline={c.deadline} />
        {c.mine.score_after != null && (
          <span className="text-[11px] tabular-nums text-slate-500">
            ★ {fmt(c.mine.score_before)} → {fmt(c.mine.score_after)}
          </span>
        )}
      </div>
      {st === "pending" && open && (
        <>
          <p className="text-[11px] text-slate-400">{C.acceptHint}</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onAction("accept", c.id)} className={cx(S.btn, S.btnPrimary, "py-2")}>
              {C.actions.accept}
            </button>
            <button onClick={() => onAction("decline", c.id)} className={cx(S.btn, S.btnGhost, "py-2")}>
              {C.actions.decline}
            </button>
          </div>
        </>
      )}
      {st === "accepted" && open && (
        <button onClick={() => onAction("claim", c.id)} className={cx(S.btn, S.btnPrimary, "py-2")}>
          {C.actions.claim}
        </button>
      )}
      {st === "claimed" && <p className="text-[11px] text-slate-400">{C.claimedHint}</p>}
    </article>
  );
}

function SentCard({ c, people, onAction }) {
  const { t } = useApp();
  const C = t.challenges;
  return (
    <article className={cx(S.card, "space-y-3 p-4")}>
      <header className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-sm font-semibold text-slate-700">{c.title}</h3>
        <TimeLeft deadline={c.deadline} />
      </header>
      {c.details && <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{c.details}</p>}
      <ul className="space-y-2">
        {c.targets.map((tg) => {
          const p = people[tg.recipient] ?? UNKNOWN_PERSON;
          return (
            <li key={tg.recipient} className="space-y-2 rounded-2xl bg-rose-50/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <Avatar person={p} size="h-7 w-7 text-sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{p.name}</span>
                <span className={cx(S.pill, "shrink-0", STATUS_TONE[tg.status])}>{C.status[tg.status]}</span>
              </div>
              {tg.status === "claimed" && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => onAction("confirm", c.id, tg.recipient)} className={cx(S.btn, S.btnPrimary, "py-1.5 text-xs")}>
                    {C.actions.confirm}
                  </button>
                  <button onClick={() => onAction("reject", c.id, tg.recipient)} className={cx(S.btn, S.btnGhost, "py-1.5 text-xs")}>
                    {C.actions.reject}
                  </button>
                </div>
              )}
              {tg.score_after != null && (
                <p className="text-right text-[11px] tabular-nums text-slate-400">
                  ★ {fmt(tg.score_before)} → {fmt(tg.score_after)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

/** Formulario de nuevo reto: título, detalles, plazo y destinatarios (amigos o grupos). */
function NewChallengeSheet({ myName, onClose, onSent }) {
  const { t, cloud, pushToast } = useApp();
  const C = t.challenges;
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [hours, setHours] = useState(24);
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  const friends = cloud.friends;
  const groups = (cloud.groups ?? []).map((g) => ({ ...g, members: g.members.filter((id) => friends.some((f) => f.id === id)) }));
  const toggle = (id) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const toggleGroup = (g) => {
    const all = g.members.length > 0 && g.members.every((id) => sel.includes(id));
    setSel((x) => (all ? x.filter((y) => !g.members.includes(y)) : [...new Set([...x, ...g.members])]));
  };
  const ready = title.trim().length >= 3 && sel.length > 0 && !busy;
  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      await remote.createChallenge(title.trim(), details.trim(), hours, sel);
      pushToast("toast", "dareSent", "good");
      onSent();
    } catch (err) {
      pushToast("toast", String(err?.message ?? "").includes("rate_limited") ? "dareLimit" : "dareFailed", "danger");
    } finally {
      setBusy(false);
    }
  };
  const chip = (on) => cx("flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs ring-1 transition", on ? "bg-pink-300 text-white ring-pink-300" : "bg-white text-slate-500 ring-slate-200 hover:ring-pink-200");
  return (
    <div className="absolute inset-0 z-[58] flex flex-col justify-end bg-slate-900/20 backdrop-blur-[2px]" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="nd-sheet max-h-[92%] space-y-4 overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-8 shadow-2xl">
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" />
        <h2 className="text-lg font-medium text-slate-700">{C.new}</h2>
        <label className="block space-y-1">
          <span className={S.label}>{C.form.title}</span>
          <input id="xt-dare-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={C.form.titlePh} className={cx(S.field, "px-4 py-3")} />
        </label>
        <label className="block space-y-1">
          <span className={S.label}>{C.form.details}</span>
          <textarea id="xt-dare-details" value={details} maxLength={280} rows={2} onChange={(e) => setDetails(e.target.value)} placeholder={C.form.detailsPh} className={cx(S.field, "resize-none p-3")} />
        </label>
        <div className="space-y-1.5">
          <p className={S.label}>{C.form.deadline}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={C.form.deadline}>
            {DARE_HOURS.map((h) => (
              <button key={h} type="button" aria-pressed={hours === h} onClick={() => setHours(h)} className={cx(S.seg, hours === h ? "bg-pink-300 text-white" : "bg-rose-50 text-slate-500")}>
                {C.hours[h]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className={S.label}>{C.form.to}</p>
            <span className={S.muted}>{C.form.selected(sel.length)}</span>
          </div>
          {groups.length > 0 && (
            <>
              <p className="text-[11px] text-slate-400">{C.form.groups}</p>
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => {
                  const on = g.members.length > 0 && g.members.every((id) => sel.includes(id));
                  return (
                    <button key={g.id} type="button" aria-pressed={on} disabled={!g.members.length} onClick={() => toggleGroup(g)} className={cx(chip(on), "pl-3 disabled:opacity-40")}>
                      #{g.name} · {g.members.length}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <p className="text-[11px] text-slate-400">{C.form.friends}</p>
          <div className="flex flex-wrap gap-1.5">
            {friends.map((f) => {
              const on = sel.includes(f.id);
              return (
                <button key={f.id} type="button" aria-pressed={on} onClick={() => toggle(f.id)} className={chip(on)}>
                  <Avatar person={f} size="h-5 w-5 text-[10px]" />
                  {f.name}
                  {f.xscore != null && <span className="opacity-70">★{fmt(f.xscore, 1)}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <p className="rounded-2xl bg-rose-50/60 p-3 text-xs leading-relaxed text-slate-500">{C.form.stakes(myName)}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className={cx(S.btn, S.btnGhost)}>
            {C.form.cancel}
          </button>
          <button type="submit" disabled={!ready} className={cx(S.btn, S.btnPrimary)}>
            {busy ? "…" : C.form.send}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Pestaña Retos: puntaje social, recibidos y enviados. */
function ChallengesTab({ data, myName, onNew, onAction }) {
  const { t, userId, cloud, login } = useApp();
  const C = t.challenges;
  if (!userId) {
    return (
      <section className={cx(S.card, "space-y-3 p-5 text-center")}>
        <p className="text-3xl text-pink-400">⚑</p>
        <h2 className="text-base font-medium text-slate-700">{C.title}</h2>
        <p className="text-sm text-slate-500">{C.intro}</p>
        <p className={S.muted}>{remote.enabled ? C.needLogin : C.demo}</p>
        {remote.enabled && (
          <div className="grid grid-cols-2 gap-2">
            <ProviderButton provider="google" label="Google" compact onClick={() => login("google", myName)} />
            <ProviderButton provider="facebook" label="Facebook" compact onClick={() => login("facebook", myName)} />
          </div>
        )}
      </section>
    );
  }
  const score = cloud.profile?.score;
  const hasFriends = cloud.friends.length > 0;
  return (
    <div className="space-y-4">
      <section className={cx(S.card, "space-y-2 p-5")}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={S.label}>{t.social.label}</p>
            <p className="text-5xl font-extralight tabular-nums text-pink-400">{score != null ? fmt(score) : "—"}</p>
          </div>
          <button onClick={onNew} disabled={!hasFriends} className={cx(S.btn, S.btnPrimary, "w-auto px-5")}>
            {C.new}
          </button>
        </div>
        <p className="text-xs text-slate-500">{t.social.hint}</p>
        <p className="text-xs text-slate-400">{hasFriends ? C.intro : C.needFriends}</p>
      </section>

      <section className="space-y-3">
        <p className={cx(S.label, "px-1")}>{C.received}</p>
        {data.received.length === 0 ? <p className={cx(S.muted, "px-1")}>{C.emptyReceived}</p> : data.received.map((c) => <ReceivedCard key={c.id} c={c} sender={data.people[c.sender]} onAction={onAction} />)}
      </section>

      <section className="space-y-3">
        <p className={cx(S.label, "px-1")}>{C.sent}</p>
        {data.sent.length === 0 ? <p className={cx(S.muted, "px-1")}>{C.emptySent}</p> : data.sent.map((c) => <SentCard key={c.id} c={c} people={data.people} onAction={onAction} />)}
      </section>
    </div>
  );
}

/** Grupos de amigos con etiquetas (solo con sesión). */
function GroupsSection({ friends }) {
  const { t, cloud, userId, reloadCloud, pushToast } = useApp();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const groups = cloud.groups ?? [];
  const fail = () => pushToast("toast", "groupFailed", "danger");
  const create = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    try {
      const g = await remote.createGroup(userId, n);
      setName("");
      setOpen(g.id);
      await reloadCloud();
    } catch {
      fail();
    }
  };
  const toggle = async (g, fid) => {
    try {
      await remote.setGroupMember(g.id, fid, !g.members.includes(fid));
      await reloadCloud();
    } catch {
      fail();
    }
  };
  const remove = async (g) => {
    if (confirm !== g.id) return setConfirm(g.id);
    try {
      await remote.deleteGroup(g.id);
      setConfirm(null);
      await reloadCloud();
    } catch {
      fail();
    }
  };
  return (
    <section className={cx(S.card, "space-y-3 p-4")}>
      <p className={S.label}>{t.groups.label}</p>
      <p className={S.muted}>{t.groups.desc}</p>
      {friends.length === 0 ? (
        <p className={S.muted}>{t.groups.needFriends}</p>
      ) : (
        <>
          <form onSubmit={create} className="flex gap-2">
            <label htmlFor="xt-group-name" className="sr-only">
              {t.groups.newPh}
            </label>
            <input id="xt-group-name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder={t.groups.newPh} className={cx(S.field, "min-w-0 flex-1 px-3 py-2")} />
            <button type="submit" disabled={!name.trim()} className={cx(S.btn, S.btnPrimary, "w-auto px-4 py-2")}>
              {t.groups.create}
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {t.groups.suggestions
              .filter((sg) => !groups.some((g) => g.name.toLowerCase() === sg.toLowerCase()))
              .map((sg) => (
                <button key={sg} type="button" onClick={() => setName(sg)} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs text-slate-500 ring-1 ring-pink-100 hover:text-pink-500">
                  #{sg}
                </button>
              ))}
          </div>
          {groups.length === 0 && <p className={S.muted}>{t.groups.empty}</p>}
          <ul className="space-y-2">
            {groups.map((g) => (
              <li key={g.id} className="rounded-2xl bg-rose-50/50 p-3 ring-1 ring-pink-100">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id} className="min-w-0 flex-1 text-left">
                    <span className="text-sm font-medium text-slate-700">#{g.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{t.groups.members(g.members.length)}</span>
                  </button>
                  <div className="flex -space-x-2">
                    {g.members.slice(0, 4).map((id) => {
                      const f = friends.find((x) => x.id === id);
                      return f ? <Avatar key={id} person={f} size="h-6 w-6 text-[10px]" /> : null;
                    })}
                  </div>
                  <button type="button" onClick={() => remove(g)} className={cx("text-xs", confirm === g.id ? "font-semibold text-rose-500" : "text-slate-400 hover:text-rose-500")}>
                    {confirm === g.id ? t.groups.confirmRemove : t.groups.remove}
                  </button>
                </div>
                {open === g.id && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {friends.map((f) => {
                      const on = g.members.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(g, f.id)}
                          className={cx("flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs ring-1 transition", on ? "bg-pink-300 text-white ring-pink-300" : "bg-white text-slate-500 ring-slate-200")}
                        >
                          <Avatar person={f} size="h-5 w-5 text-[10px]" />
                          {f.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Hoja para compartir: imagen + compartir/descargar/copiar. */
function ShareSheet({ image, text, filename, onClose }) {
  const { t, track, pushToast } = useApp();
  const [copied, setCopied] = useState(false);
  const textRef = useRef(null);
  useEffect(() => track("views"), [track]);

  const share = async () => {
    try {
      const file = new File([dataUrlToBlob(image)], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        track("shares");
        return;
      }
    } catch {
      /* cancelado o no soportado: se descarga */
    }
    download();
  };
  const download = async () => {
    // Dentro de claude.ai la descarga pasa por la capacidad `downloads`; en Vite, por un enlace normal
    const downloads = window.claude?.use ? await window.claude.use("downloads").catch(() => null) : null;
    if (downloads) {
      try {
        await downloads.save({ filename, data: dataUrlToBlob(image) });
        track("downloads");
      } catch {
        /* el usuario canceló o no está disponible: la imagen sigue visible para guardarla a mano */
      }
      return;
    }
    const a = document.createElement("a");
    a.href = image;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    track("downloads");
  };
  const copy = () => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        track("copies");
        pushToast("toast", "copied", "good");
      })
      .catch(() => {
        textRef.current?.select();
        pushToast("toast", "copyFailed", "danger");
      });
  };

  return (
    <div className="absolute inset-0 z-[58] flex flex-col justify-end bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose}>
      <div className="nd-sheet max-h-[92%] space-y-3 overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" />
        <p className={S.label}>{t.share.title}</p>
        <img src={image} alt={text} className="mx-auto max-h-[46vh] w-auto max-w-full rounded-2xl shadow-lg ring-1 ring-pink-100 sm:max-h-80" />
        <p className="text-center text-[10px] text-slate-400">{t.share.hint}</p>
        <textarea ref={textRef} readOnly value={text} rows={2} className={cx(S.field, "resize-none p-2 text-xs")} aria-label={t.share.copy} />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={share} className={cx(S.btn, S.btnPrimary, "col-span-2")}>
            {t.share.share}
          </button>
          <button onClick={download} className={cx(S.btn, S.btnGhost)}>
            {t.share.download}
          </button>
          <button onClick={copy} className={cx(S.btn, S.btnGhost)}>
            {copied ? t.share.copied : t.share.copy}
          </button>
        </div>
        <button onClick={onClose} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600">
          {t.share.close}
        </button>
      </div>
    </div>
  );
}

function Countdown() {
  const { t } = useApp();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const d = new Date(now);
  const left = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d;
  const hms = [Math.floor(left / 3600000), Math.floor((left % 3600000) / 60000), Math.floor((left % 60000) / 1000)].map(pad).join(":");
  return <p className={cx(S.muted, "text-center tabular-nums")}>{t.daily.next(hms)}</p>;
}

/** Reto diario: la misma situación para todo el mundo, cada día. */
function DailyChallenge({ entry, onPick, onShare }) {
  const { t, sfx } = useApp();
  const key = dateKey();
  const scenario = entry?.scenario ?? scenarioFor(key);
  const sc = t.daily.scenarios[scenario];
  const picks = entry?.picks ?? [];
  const step = picks.length;
  const [flash, setFlash] = useState(null);
  const { userId, cloud } = useApp();
  const demoFriends = useMemo(() => backend.getFriendsDaily(key), [key]);
  const friends = userId ? cloud.friends.filter((f) => f.score != null) : demoFriends;

  const choose = (opt) => {
    sfx.unlock();
    const stars = DAILY_EFFECTS[scenario][step][opt][0];
    if (stars >= 4) sfx.playHarp();
    else if (stars <= 2) sfx.playThud();
    setFlash(stars);
    setTimeout(() => setFlash(null), 900);
    onPick(scenario, opt);
  };

  return (
    <section className={cx(S.card, "space-y-3 p-4")}>
      <div className="flex items-center justify-between">
        <p className={S.label}>{t.daily.title(dayNumber())}</p>
        {flash && <span className={cx(S.pill, "nd-pop", flash >= 4 ? "bg-pink-100 text-pink-500" : flash <= 2 ? "bg-slate-200 text-slate-500" : "bg-rose-50 text-rose-400")}>{t.daily.received(flash)}</span>}
      </div>
      <h3 className="text-base font-medium text-slate-700">{sc.title}</h3>
      {!entry?.done ? (
        <>
          <p className={S.muted}>{t.daily.step(step + 1, 3)}</p>
          <p key={step} className="nd-pop text-sm text-slate-600">
            {sc.steps[step].q}
          </p>
          <div className="grid gap-2">
            {sc.steps[step].o.map((label, i) => (
              <button key={`${step}-${i}`} type="button" onClick={() => choose(i)} className="rounded-2xl bg-rose-50/70 px-4 py-3 text-left text-sm text-slate-600 ring-1 ring-pink-100 transition hover:bg-pink-50 active:scale-[0.99]">
                {label}
              </button>
            ))}
          </div>
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className={cx("h-1.5 w-6 rounded-full", i < step ? "bg-pink-300" : "bg-slate-200")} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="text-center">
            <p className={S.label}>{t.daily.scoreLabel}</p>
            <p className="text-6xl font-extralight tabular-nums text-pink-400">{fmt(entry.score)}</p>
            <p className="mt-1 text-3xl tracking-[0.3em]">{entry.grid}</p>
          </div>
          <button onClick={() => onShare(entry, sc.title)} className={cx(S.btn, S.btnPrimary)}>
            {t.daily.share}
          </button>
          <div>
            <p className={cx(S.label, "mb-2")}>{t.daily.friendsToday}</p>
            <ul className="space-y-1.5">
              {[...friends.map((f) => ({ id: f.id, name: f.name, avatar: f.avatar, gradient: f.gradient, score: f.score })), { id: "me", name: t.daily.you, avatar: "⭐", gradient: "from-pink-200 to-rose-100", score: entry.score, me: true }]
                .sort((a, b) => b.score - a.score)
                .map((f, i) => (
                  <li key={f.id} className={cx("flex items-center gap-3 rounded-2xl px-3 py-1.5", f.me ? "bg-pink-50 ring-1 ring-pink-200" : "")}>
                    <span className="w-4 text-xs tabular-nums text-slate-400">{i + 1}</span>
                    <Avatar person={f} size="h-7 w-7 text-sm" />
                    <span className="flex-1 text-sm text-slate-600">{f.name}</span>
                    <ScorePill score={f.score} />
                  </li>
                ))}
            </ul>
          </div>
          <Countdown />
        </>
      )}
    </section>
  );
}

/** Resumen semanal y su tarjeta. */
function useWeek(state, t) {
  return useMemo(() => {
    const keys = lastDays(7);
    const sum = (f) => keys.reduce((acc, k) => acc + (state.days[k]?.[f] ?? 0), 0);
    const dailies = keys.map((k) => state.daily[k]).filter((d) => d?.done);
    const avg = dailies.length ? fmt(dailies.reduce((a, d) => a + d.score, 0) / dailies.length) : "—";
    return [
      [t.week.runs, sum("runs")],
      [t.week.prisons, sum("prisons")],
      [t.week.elites, sum("elites")],
      [t.week.posts, sum("posts")],
      [t.week.dailies, dailies.length],
      [t.week.avgDaily, avg],
      [t.week.bestSpeedrun, fmtTime(state.records.speedrun)],
      [t.week.bestSurvival, fmtTime(state.records.survival)],
    ];
  }, [state.days, state.daily, state.records, t]);
}

function TodayTab({ state, dispatch, metrics, openShare, goPlay, onHelp }) {
  const { t } = useApp();
  const week = useWeek(state, t);
  const entry = state.daily[dateKey()];
  const name = state.profile?.name ?? INITIAL_ME.name;
  const shareDaily = (e, title) => {
    const n = dayNumber();
    openShare({
      image: renderDailyCard({ t, n, title, score: e.score, grid: e.grid }),
      text: `XTATS · ${t.daily.title(n)}\n${fmt(e.score)} ${e.grid}\n#XTATS xtats.app`,
      filename: `xtats-reto-${n}.png`,
      event: "dailyShares",
    });
  };
  const shareWeek = () =>
    openShare({
      image: renderWeekCard({ t, name, rows: week.slice(0, 6) }),
      text: `${t.week.label} · ${week.map(([k, v]) => `${k}: ${v}`).slice(0, 3).join(" · ")}\n#XTATS xtats.app`,
      filename: "xtats-semana.png",
    });

  return (
    <div className="space-y-4">
      <section className="px-1 pt-1">
        <p className="text-2xl font-light text-slate-700">
          {name} <span className="text-pink-400">✦</span>
        </p>
        <p className={S.muted}>{t.tagline}</p>
      </section>

      <DailyChallenge
        entry={entry}
        onPick={(scenario, option) => {
          const willFinish = (entry?.picks?.length ?? 0) === 2;
          dispatch({ type: "DAILY_PICK", date: dateKey(), scenario, option });
          if (willFinish) metrics.track("dailies");
        }}
        onShare={shareDaily}
      />

      <section className={cx(S.card, "space-y-3 p-4")}>
        <p className={S.label}>{t.week.label}</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {week.slice(0, 6).map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-rose-50/60 px-1 py-2">
              <p className="text-lg tabular-nums text-slate-700">{v}</p>
              <p className="text-[10px] leading-tight text-slate-400">{k}</p>
            </div>
          ))}
        </div>
        <button onClick={shareWeek} className={cx(S.btn, S.btnGhost)}>
          {t.week.open}
        </button>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={onHelp} className={cx(S.btn, S.btnGhost)}>
          {t.howto.open}
        </button>
        <button onClick={goPlay} className={cx(S.btn, S.btnPrimary)}>
          {t.modeBar.start} ★
        </button>
      </div>

      <details className={cx(S.card, "p-4")}>
        <summary className={cx(S.label, "cursor-pointer")}>{t.metrics.label}</summary>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {[
            ["views", t.metrics.views],
            ["shares", t.metrics.shares],
            ["downloads", t.metrics.downloads],
            ["copies", t.metrics.copies],
            ["dailies", t.metrics.dailies],
            ["photos", t.metrics.photos],
            ["invites", t.metrics.invites],
          ].map(([k, label]) => (
            <div key={k} className="flex justify-between gap-2 border-b border-rose-50 py-1">
              <dt className="text-slate-400">{label}</dt>
              <dd className="tabular-nums text-slate-600">{metrics.values[k] ?? 0}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[10px] text-slate-400">{t.metrics.installs}</p>
      </details>
    </div>
  );
}

/** Filtro de cámara: puntaje flotando sobre la cabeza. */
function CameraTab({ name, score, openShare }) {
  const { t, track } = useApp();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState(false);
  const [headY, setHeadY] = useState(0.18);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setLive(false);
  }, []);
  useEffect(() => stop, [stop]);
  useEffect(() => {
    if (live && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [live]);

  const open = async () => {
    setError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false });
      streamRef.current = stream;
      setLive(true);
    } catch {
      setError(true);
    }
  };

  const finish = (image) => {
    track("photos");
    openShare({ image, text: `${name} ★ ${fmt(score)} · XTATS\n#XTATS xtats.app`, filename: "xtats-filtro.png" });
  };
  const capture = () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    finish(composePhoto({ source: v, sw: v.videoWidth, sh: v.videoHeight, mirror: true, headY, name, score }));
  };
  const upload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => finish(composePhoto({ source: img, sw: img.naturalWidth, sh: img.naturalHeight, mirror: false, headY, name, score }));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <section className="px-1 pt-1">
        <p className={S.label}>{t.camera.label}</p>
        <p className="mt-1 text-sm text-slate-500">{t.camera.intro}</p>
      </section>
      <div className="relative mx-auto aspect-[9/16] w-full max-w-full overflow-hidden rounded-3xl bg-gradient-to-br from-pink-100 via-white to-slate-100 ring-1 ring-pink-100">
        {live ? (
          <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" style={{ filter: "brightness(1.1) contrast(0.88) saturate(0.82) sepia(0.1)" }} />
        ) : (
          <div className="grid h-full place-items-center text-7xl opacity-60">🤳</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-pink-50/30 via-transparent to-pink-50/30" />
        <div className="nd-hover absolute left-1/2 -translate-x-1/2" style={{ top: `${headY * 100}%` }}>
          <span className="block -translate-y-1/2 whitespace-nowrap rounded-full bg-white/85 px-4 py-1.5 text-sm font-medium text-pink-500 shadow-[0_0_24px_rgba(236,72,153,0.35)]">
            {name} ★ {fmt(score)}
          </span>
        </div>
      </div>
      <label className="block space-y-1">
        <span className={S.label}>{t.camera.height}</span>
        <input id="xt-head" type="range" min="0.06" max="0.6" step="0.01" value={headY} onChange={(e) => setHeadY(Number(e.target.value))} className="w-full accent-pink-400" />
      </label>
      {error && <p className="rounded-2xl bg-slate-100 px-4 py-3 text-xs text-slate-500">{t.camera.denied}</p>}
      <div className="grid grid-cols-2 gap-2">
        {live ? (
          <>
            <button onClick={capture} className={cx(S.btn, S.btnPrimary)}>
              {t.camera.capture}
            </button>
            <button onClick={stop} className={cx(S.btn, S.btnGhost)}>
              {t.camera.stop}
            </button>
          </>
        ) : (
          <>
            <button onClick={open} className={cx(S.btn, S.btnPrimary)}>
              {t.camera.open}
            </button>
            <label className={cx(S.btn, S.btnGhost, "cursor-pointer text-center")}>
              {t.camera.upload}
              <input id="xt-upload" type="file" accept="image/*" onChange={upload} className="sr-only" />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

/** Amigos: grupo, récords, reto de hoy y bloqueados. Con sesión usa Supabase; sin ella, datos de demo. */
function FriendsTab({ state, dispatch }) {
  const { t, track, pushToast, userId, cloud, reloadCloud, login, logout, myPhoto } = useApp();
  const [mode, setMode] = useState("speedrun");
  const [code, setCode] = useState("");
  const live = !!userId;
  const key = dateKey();
  const myDaily = state.daily[key];
  const demoToday = useMemo(() => backend.getFriendsDaily(key), [key]);
  const friends = live ? cloud.friends : backend.getFriends();
  const today = live ? cloud.friends.filter((f) => f.score != null) : demoToday;
  const inviteCode = live ? cloud.profile?.invite_code ?? "…" : state.inviteCode;

  const rows = [...friends.map((f) => ({ ...f, value: f.records[mode] })), { id: "me", name: t.friends.you, avatar: "⭐", gradient: "from-pink-200 to-rose-100", photo: myPhoto, value: state.records[mode], me: true }].sort((a, b) => {
    if (a.value == null) return 1;
    if (b.value == null) return -1;
    return LOWER_IS_BETTER[mode] ? a.value - b.value : b.value - a.value;
  });

  const copyInvite = () => {
    navigator.clipboard
      ?.writeText(t.friends.inviteText(inviteCode))
      .then(() => {
        track("invites");
        pushToast("toast", "copied", "good");
      })
      .catch(() => pushToast("toast", "copyFailed", "danger"));
  };

  const addFriend = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    try {
      await remote.addFriend(code.trim());
      setCode("");
      pushToast("toast", "friendAdded", "good");
      reloadCloud();
    } catch {
      pushToast("toast", "friendFailed", "danger");
    }
  };

  return (
    <div className="space-y-4">
      <section className={cx(S.card, "space-y-3 p-4")}>
        <p className={S.label}>{t.friends.group}</p>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50/60 px-4 py-3">
          <div>
            <p className="text-[10px] text-slate-400">{t.friends.code}</p>
            <p className="select-all font-mono text-lg tracking-widest text-slate-700">{inviteCode}</p>
          </div>
          <button onClick={copyInvite} className="rounded-full bg-pink-300 px-3 py-1.5 text-xs font-medium text-white">
            {t.friends.copyInvite}
          </button>
        </div>
        {live ? (
          <>
            <form onSubmit={addFriend} className="flex gap-2">
              <label htmlFor="xt-friend-code" className="sr-only">
                {t.friends.addLabel}
              </label>
              <input id="xt-friend-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t.friends.addPh} className={cx(S.field, "min-w-0 flex-1 px-3 py-2 font-mono")} />
              <button type="submit" disabled={!code.trim()} className={cx(S.btn, S.btnPrimary, "w-auto px-4 py-2")}>
                {t.friends.add}
              </button>
            </form>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>{t.friends.connectedAs(cloud.profile?.name ?? "…")}</span>
              <button onClick={logout} className="text-pink-400 hover:text-pink-600">
                {t.friends.signOut}
              </button>
            </div>
          </>
        ) : remote.enabled ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">{t.friends.connect}</p>
            <div className="grid grid-cols-2 gap-2">
              <ProviderButton provider="google" label="Google" compact onClick={() => login("google", state.profile?.name ?? INITIAL_ME.name)} />
              <ProviderButton provider="facebook" label="Facebook" compact onClick={() => login("facebook", state.profile?.name ?? INITIAL_ME.name)} />
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400">{t.friends.demo}</p>
        )}
      </section>

      {live && <GroupsSection friends={friends} />}

      <section className={cx(S.card, "space-y-3 p-4")}>
        <p className={S.label}>{t.friends.leaderboard}</p>
        <div className="flex flex-wrap gap-1.5" role="group">
          {RECORD_MODES.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cx(S.seg, mode === m ? "bg-pink-300 text-white" : "bg-rose-50 text-slate-500")}>
              {t.modes[m].name}
            </button>
          ))}
        </div>
        {live && friends.length === 0 && <p className={S.muted}>{t.friends.empty}</p>}
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.id} className={cx("flex items-center gap-3 rounded-2xl px-3 py-1.5", r.me ? "bg-pink-50 ring-1 ring-pink-200" : "")}>
              <span className="w-4 text-xs tabular-nums text-slate-400">{r.value == null ? "–" : i + 1}</span>
              <Avatar person={r} size="h-7 w-7 text-sm" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{r.name}</span>
              <span className="font-mono text-xs tabular-nums text-slate-500">{fmtTime(r.value)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={cx(S.card, "space-y-2 p-4")}>
        <p className={S.label}>{t.friends.today}</p>
        {!myDaily?.done && <p className={S.muted}>{t.friends.notPlayed}</p>}
        <ul className="space-y-1.5">
          {[...today, ...(myDaily?.done ? [{ id: "me", name: t.friends.you, avatar: "⭐", gradient: "from-pink-200 to-rose-100", photo: myPhoto, score: myDaily.score, me: true }] : [])]
            .sort((a, b) => b.score - a.score)
            .map((f) => (
              <li key={f.id} className={cx("flex items-center gap-3 rounded-2xl px-3 py-1.5", f.me ? "bg-pink-50 ring-1 ring-pink-200" : "")}>
                <Avatar person={f} size="h-7 w-7 text-sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{f.name}</span>
                <ScorePill score={f.score} />
              </li>
            ))}
        </ul>
      </section>

      <section className={cx(S.card, "space-y-2 p-4")}>
        <p className={S.label}>{t.friends.blocked}</p>
        {state.blocked.length === 0 ? (
          <p className={S.muted}>{t.friends.noneBlocked}</p>
        ) : (
          <ul className="space-y-1.5">
            {state.blocked.map((id) => {
              const u = state.users[id] ?? INITIAL_USERS[id];
              if (!u) return null;
              return (
                <li key={id} className="flex items-center gap-3">
                  <Avatar person={u} size="h-7 w-7 text-sm" />
                  <span className="flex-1 text-sm text-slate-500">{u.name}</span>
                  <button onClick={() => dispatch({ type: "UNBLOCK", userId: id })} className="text-xs text-pink-400 hover:text-pink-600">
                    {t.friends.unblock}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Primera vez: idioma, nombre, edad mínima y aviso de sátira. */
function Onboarding({ lang, setLang, onDone, onUnderage }) {
  const { t, login } = useApp();
  const year = new Date().getFullYear();
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [ok, setOk] = useState(false);
  const ready = name.trim() && birth && ok;
  const underage = () => year - Number(birth) < MIN_AGE;
  const submit = (e) => {
    e.preventDefault();
    if (!ready) return;
    if (underage()) onUnderage();
    else onDone(name.trim().slice(0, 20));
  };
  const social = (provider) => {
    if (!ready) return;
    if (underage()) onUnderage();
    else login(provider, name.trim().slice(0, 20));
  };
  return (
    <form onSubmit={submit} className="absolute inset-0 z-[59] overflow-y-auto bg-gradient-to-b from-rose-50 via-white to-pink-50">
      <div className="flex justify-end px-6 pt-4">
        <LangSwitch lang={lang} onChange={setLang} />
      </div>
      <div className="space-y-5 px-7 pb-10 pt-8">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Logo />
          </div>
          <p className="nd-pop text-6xl font-extralight tabular-nums text-pink-400">4.10</p>
          <p className="text-sm text-slate-500">{t.tagline}</p>
        </div>
        <label className="block space-y-1">
          <span className={S.label}>{t.onboarding.nameLabel}</span>
          <input id="xt-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder={t.onboarding.namePh} className={cx(S.field, "px-4 py-3")} />
        </label>
        <label className="block space-y-1">
          <span className={S.label}>{t.onboarding.yearLabel}</span>
          <select id="xt-birth" value={birth} onChange={(e) => setBirth(e.target.value)} className={cx(S.field, "px-4 py-3")}>
            <option value="">{t.onboarding.yearPh}</option>
            {Array.from({ length: 86 }, (_, i) => year - 5 - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-3 rounded-2xl bg-white/80 p-3 text-xs leading-relaxed text-slate-500 ring-1 ring-pink-100">
          <input id="xt-satire" type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 accent-pink-400" />
          <span>{t.onboarding.satire}</span>
        </label>
        <button type="submit" disabled={!ready} className={cx(S.btn, S.btnPrimary)}>
          {t.onboarding.start}
        </button>
        <div className="grid gap-2">
          {[
            ["google", t.onboarding.google],
            ["facebook", t.onboarding.meta],
          ].map(([provider, label]) => (
            <ProviderButton key={provider} provider={provider} label={label} disabled={!remote.enabled || !ready} onClick={() => social(provider)} />
          ))}
          {!remote.enabled && <p className="text-center text-[10px] text-slate-400">{t.onboarding.needsServer}</p>}
        </div>
        <p className="text-center text-[10px] text-slate-400">{t.onboarding.privacy}</p>
      </div>
    </form>
  );
}

function Underage({ onWipe }) {
  const { t } = useApp();
  return (
    <div className={cx(S.overlay, "z-[59] bg-gradient-to-b from-rose-50 to-white")}>
      <Logo />
      <h2 className="mt-8 text-lg font-medium text-slate-700">{t.onboarding.underageTitle}</h2>
      <p className="mt-2 text-sm text-slate-500">{t.onboarding.underageBody}</p>
      <button onClick={onWipe} className="mt-10 text-xs text-slate-400 underline">
        {t.onboarding.wipe}
      </button>
    </div>
  );
}

function TabBar({ tab, setTab, badges = {} }) {
  const { t } = useApp();
  const items = [
    ["today", "◐"],
    ["play", "★"],
    ["camera", "◎"],
    ["challenges", "⚑"],
    ["friends", "◇"],
  ];
  return (
    <nav className="absolute inset-x-0 bottom-0 z-[45] border-t border-pink-100 bg-white/85 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur" aria-label="XTATS">
      <ul className="grid grid-cols-5">
        {items.map(([id, icon]) => (
          <li key={id}>
            <button type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} className={cx("flex w-full flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition", tab === id ? "text-pink-500" : "text-slate-400 hover:text-slate-600")}>
              <span className="relative text-lg leading-none">
                {icon}
                {badges[id] > 0 && <span className="absolute -right-2.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">{badges[id]}</span>}
              </span>
              {t.tabs[id]}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* =========================================================================
   9. APP
   ========================================================================= */
function initialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {
    /* sin almacenamiento */
  }
  const nav = (navigator.language || "es").toLowerCase();
  return nav.startsWith("pt") ? "pt" : nav.startsWith("es") ? "es" : "en";
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [lang, setLang] = useState(initialLang);
  const [tab, setTab] = useState("play");
  const [query, setQuery] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [trend, setTrend] = useState(null);
  const [showElite, setShowElite] = useState(false);
  const [complaining, setComplaining] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [anxious, setAnxious] = useState(false);
  const [picker, setPicker] = useState(false);
  const [sincere, setSincere] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [account, setAccount] = useState(false);
  const [howto, setHowto] = useState(false);
  const [metricsValues, track] = useMetrics();
  const [session, setSession] = useState(null);
  const [cloud, setCloud] = useState({ profile: null, friends: [], groups: [], loading: false });
  const [chal, setChal] = useState({ received: [], sent: [], people: {}, loading: false });
  const [newDare, setNewDare] = useState(false);
  const [skin, setSkin] = useState(() => {
    try {
      const v = localStorage.getItem(SKIN_KEY);
      return SKINS.includes(v) ? v : "pink";
    } catch {
      return "pink";
    }
  });

  const t = I18N[lang];
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const sfx = useSynth(soundRef);

  const timers = useRef([]);
  const prevScore = useRef(state.me.score);
  const scoreRef = useRef(state.me.score);
  const clicks = useRef([]);
  const anxietyCooldown = useRef(0);

  const { me, users, rated, myPosts, cascade, history, log, run, records, profile, underage } = state;
  const rules = MODES[run.mode];
  const onboarded = !!profile && !underage;
  const runActive = onboarded && !run.endedAt;
  const inPrison = me.score <= T.prison;
  const isLocked = me.score < T.locked;
  const isWarning = me.score < T.warning;
  const isExpensive = me.score < T.expensive;
  const isElite = me.score > T.elite;
  const influence = influenceKey(me.score);

  /* ---------- Persistencia ---------- */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* sin almacenamiento */
    }
  }, [state]);
  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* sin almacenamiento */
    }
    document.documentElement.lang = lang;
  }, [lang]);

  /* ---------- Toasts ---------- */
  const pushToast = useCallback((group, key, tone = "alert", ms = 4200) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((x) => [...x.slice(-2), { id, group, key, tone }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), ms);
  }, []);

  /* ---------- Supabase: sesión, perfil y amigos ---------- */
  const userId = session?.user?.id ?? null;
  const profileRef = useRef(state.profile);
  profileRef.current = state.profile;

  useEffect(() => {
    if (!remote.enabled) return;
    remote.getSession().then(setSession);
    return remote.onAuthChange(setSession);
  }, []);

  const reloadCloud = useCallback(async () => {
    if (!userId) return setCloud({ profile: null, friends: [], groups: [], loading: false });
    setCloud((c) => ({ ...c, loading: true }));
    try {
      let profile = await remote.getProfile(userId);
      if (!profile) {
        let pending = null;
        try {
          pending = localStorage.getItem(PENDING_KEY);
        } catch {
          /* sin almacenamiento */
        }
        // Solo se crea perfil si la persona pasó por el inicio (edad + aviso de sátira)
        if (!pending) {
          await remote.signOut();
          return;
        }
        profile = await remote.createProfile(userId, pending.slice(0, 20));
      }
      try {
        localStorage.removeItem(PENDING_KEY);
      } catch {
        /* sin almacenamiento */
      }
      if (!profileRef.current) dispatch({ type: "ONBOARD", name: profile.name });
      const mine = await remote.loadMine(userId, dateKey());
      dispatch({ type: "MERGE_REMOTE", day: dateKey(), ...mine });
      const [friends, groups] = await Promise.all([remote.loadFriends(userId, dateKey()), remote.loadGroups()]);
      setCloud({ profile, friends, groups, loading: false });
    } catch {
      setCloud((c) => ({ ...c, loading: false }));
    }
  }, [userId]);
  useEffect(() => {
    reloadCloud();
  }, [reloadCloud]);

  /** Inicia sesión con Google o Meta guardando antes el nombre elegido. */
  const login = useCallback(
    (provider, name) => {
      try {
        localStorage.setItem(PENDING_KEY, name);
      } catch {
        /* sin almacenamiento */
      }
      remote.signIn(provider).catch(() => pushToast("toast", "loginFailed", "danger"));
    },
    [pushToast]
  );
  /** Cierra sesión (o sale del modo invitado) y vuelve a la pantalla de inicio. */
  const logout = useCallback(async () => {
    try {
      if (remote.enabled) await remote.signOut();
    } catch {
      /* sin conexión: igual se limpia este dispositivo */
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* sin almacenamiento */
    }
    setSession(null);
    setAccount(false);
    setNewDare(false);
    setSincere(false);
    setPicker(false);
    setTab("play");
    dispatch({ type: "WIPE" });
  }, []);

  // Récords y retos se envían al servidor (la función SQL conserva la mejor marca)
  useEffect(() => {
    if (userId && run.endedAt && run.counts) remote.submitRecord(run.mode, run.time).catch(() => {});
  }, [userId, run.endedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const todayEntry = state.daily[dateKey()];
  useEffect(() => {
    if (userId && todayEntry?.done) remote.submitDaily(userId, dateKey(), todayEntry.score, todayEntry.grid).catch(() => {});
  }, [userId, todayEntry?.done]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Estilo visual ---------- */
  useEffect(() => {
    try {
      localStorage.setItem(SKIN_KEY, skin);
    } catch {
      /* sin almacenamiento */
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", { pink: "#fbcfe8", black: "#040605", white: "#ffffff" }[skin]);
  }, [skin]);

  /* ---------- Retos: cargar, refrescar cada 30 s en la pestaña y responder ---------- */
  const reloadChallenges = useCallback(async () => {
    if (!userId) return setChal({ received: [], sent: [], people: {}, loading: false });
    setChal((c) => ({ ...c, loading: true }));
    try {
      const d = await remote.loadChallenges(userId);
      setChal({ ...d, loading: false });
    } catch {
      setChal((c) => ({ ...c, loading: false }));
    }
  }, [userId]);
  useEffect(() => {
    reloadChallenges();
  }, [reloadChallenges]);
  useEffect(() => {
    if (tab !== "challenges" || !userId) return;
    reloadChallenges();
    reloadCloud();
    const id = setInterval(reloadChallenges, 30000);
    return () => clearInterval(id);
  }, [tab, userId, reloadChallenges, reloadCloud]);

  const dareAction = async (kind, id, recipient) => {
    try {
      if (kind === "accept" || kind === "decline") await remote.respondChallenge(id, kind === "accept");
      else if (kind === "claim") await remote.claimChallenge(id);
      else await remote.resolveChallenge(id, recipient, kind === "confirm");
      pushToast("toast", { accept: "dareAccepted", decline: "dareDeclined", claim: "dareClaimed", confirm: "dareResolved", reject: "dareResolved" }[kind], "good");
      if (kind === "accept" || kind === "claim") sfx.playHarp();
    } catch {
      pushToast("toast", "dareFailed", "danger");
    }
    reloadChallenges();
    reloadCloud();
  };
  const pendingDares = chal.received.filter((c) => c.mine.status === "pending" && new Date(c.deadline).getTime() > Date.now()).length;

  /* ---------- Foto de perfil: local siempre; en Supabase si hay sesión ---------- */
  const myPhoto = state.profile?.photo || cloud.profile?.avatar_url || null;
  const setPhoto = async (dataUrl) => {
    dispatch({ type: "SET_PHOTO", photo: dataUrl });
    if (!userId) return pushToast("toast", "photoSaved", "good");
    try {
      if (dataUrl) {
        const avatarUrl = await remote.uploadAvatar(userId, dataUrlToBlob(dataUrl));
        setCloud((c) => ({ ...c, profile: { ...c.profile, avatar_url: avatarUrl } }));
      } else {
        await remote.removeAvatar(userId);
        setCloud((c) => ({ ...c, profile: { ...c.profile, avatar_url: null } }));
      }
      pushToast("toast", "photoSaved", "good");
    } catch {
      pushToast("toast", "photoFailed", "danger");
    }
  };

  const receive = useCallback(
    (rater, stars, reason) => {
      dispatch({ type: "RECEIVE_RATING", rater, stars, reason, meta: meta() });
      if (stars >= 4) sfx.playHarp();
      else if (stars <= 2) sfx.playThud();
    },
    [sfx]
  );
  const receiveRef = useRef(receive);
  receiveRef.current = receive;

  const schedule = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  /* ---------- Cambios de MI puntaje: animación, élite, prisión ---------- */
  useEffect(() => {
    const prev = prevScore.current;
    const curr = me.score;
    scoreRef.current = curr;
    if (curr === prev) return;
    prevScore.current = curr;
    setTrend(curr > prev ? "up" : "down");
    if (!runActive) return;
    if (prev <= T.elite && curr > T.elite) {
      if (run.mode === "climb") dispatch({ type: "END_RUN", outcome: "elite", now: Date.now() });
      else {
        setShowElite(true);
        dispatch({ type: "DAY_INC", field: "elites" });
      }
    }
    if (prev > T.prison && curr <= T.prison) {
      sfx.playError();
      dispatch({ type: "END_RUN", outcome: "prison", now: Date.now() });
    }
  }, [me.score, sfx, runActive, run.mode]);

  useEffect(() => {
    if (!showElite) return;
    const id = setTimeout(() => setShowElite(false), 4500);
    return () => clearTimeout(id);
  }, [showElite]);

  /* ---------- Contrarreloj 4.5: reloj de 2 minutos ---------- */
  useEffect(() => {
    if (!runActive || !rules.limitMs) return;
    const id = setInterval(() => {
      if (Date.now() - run.startedAt >= rules.limitMs) dispatch({ type: "END_RUN", outcome: "timeout", now: Date.now() });
    }, 500);
    return () => clearInterval(id);
  }, [runActive, rules.limitMs, run.startedAt]);

  /* ---------- Efecto cascada ---------- */
  useEffect(() => {
    if (!runActive) return;
    if (!cascade && me.score < rules.cascadeAt) {
      dispatch({ type: "SET_CASCADE", on: true, meta: meta() });
      pushToast("toast", "cascadeOn", "danger");
    }
    if (cascade && me.score >= rules.cascadeAt + 0.3) {
      dispatch({ type: "SET_CASCADE", on: false, meta: meta() });
      pushToast("toast", "cascadeOff", "good");
    }
  }, [me.score, cascade, runActive, rules.cascadeAt, pushToast]);

  useEffect(() => {
    if (!cascade || !runActive) return;
    const id = setInterval(
      () => {
        if (scoreRef.current < T.locked) receiveRef.current(SYSTEM, 0, "sanction");
        else receiveRef.current(pick(RESENTFUL_BOTS), 1, "toxic");
      },
      isLocked ? CASCADE_MS.locked : CASCADE_MS.normal
    );
    return () => clearInterval(id);
  }, [cascade, runActive, isLocked]);

  /* ---------- Paranoia (más rápida y dura en Supervivencia) ---------- */
  useEffect(() => {
    if (!runActive || isLocked) return;
    let id;
    const [min, max] = rules.paranoia;
    const next = () => {
      id = setTimeout(
        () => {
          const p = pick(PARANOIA);
          pushToast("paranoia", p.key, "alert");
          if (p.rating) receiveRef.current(p.rating.rater, p.rating.stars, p.rating.reason);
          else if (rules.harsh) receiveRef.current(pick([...RESENTFUL_BOTS, ...VIP_BOTS]), pick([1, 1, 2, 3, 4, 5]), "vibes");
          next();
        },
        min + Math.random() * (max - min)
      );
    };
    next();
    return () => clearTimeout(id);
  }, [runActive, isLocked, rules, pushToast]);

  useEffect(() => {
    if (isLocked) {
      clearTimers();
      setComplaining(false);
    }
  }, [isLocked]);

  /* ---------- Analizador de ansiedad ---------- */
  const onAnyPointer = () => {
    if (!runActive || tab !== "play") return;
    const now = performance.now();
    clicks.current = [...clicks.current.filter((c) => now - c < ANXIETY.windowMs), now];
    if (clicks.current.length >= ANXIETY.clicks && now > anxietyCooldown.current) {
      anxietyCooldown.current = now + ANXIETY.cooldownMs;
      clicks.current = [];
      dispatch({ type: "PENALTY", amount: ANXIETY.penalty, meta: meta() });
      pushToast("toast", "anxiety", "danger");
      sfx.playThud();
      setAnxious(true);
      setTimeout(() => setAnxious(false), 600);
    }
  };

  /* ---------- Acciones ---------- */
  const startRun = (mode) => {
    clearTimers();
    setComplaining(false);
    setShowElite(false);
    setSincere(false);
    setPicker(false);
    dispatch({ type: "START_RUN", mode });
    setTab("play");
  };

  const ratePost = (post, stars) => {
    sfx.unlock();
    dispatch({ type: "RATE_POST", postId: post.id, userId: post.userId, stars, meta: meta() });
  };

  const receiveRandomRating = () => {
    sfx.unlock();
    const known = pick(Object.values(users));
    const rater = Math.random() < 0.5 ? { name: known.name, score: known.score } : { key: pick(STRANGERS), score: round2(0.8 + Math.random() * 4.2) };
    receive(rater, randomStars());
  };

  const publish = (raw) => {
    sfx.unlock();
    const mod = moderate(raw);
    if (mod.masked) pushToast("toast", "moderated", "alert");
    const { happy, negative } = analyzeText(mod.text);
    dispatch({ type: "PUBLISH", text: mod.text, happy, negative, meta: meta() });
    let delay = 500;
    for (let i = 0; i < happy.length * 2; i++, delay += 280) schedule(() => receiveRef.current(pick(VIP_BOTS), 5, "inspiring"), delay);
    for (let i = 0; i < negative.length * 3; i++, delay += 280) schedule(() => receiveRef.current(pick(VIP_BOTS), 1, "negativity"), delay);
    if (negative.length) pushToast("toast", "negPost", "danger");
  };

  const complain = () => {
    sfx.unlock();
    setComplaining(true);
    dispatch({ type: "LOG", tone: "down", logType: "complaint", meta: meta() });
    const hypocrites = [...VIP_BOTS, { key: "airport", score: 4.6 }, { key: "neighbor", score: 4.55 }];
    for (let i = 0; i < 6; i++) {
      schedule(() => {
        receiveRef.current(pick(hypocrites), 1, "misconduct");
        if (i === 5) setComplaining(false);
      }, 800 + i * 700);
    }
  };

  const openShare = useCallback(
    ({ image, text, filename, event }) => {
      if (event) track(event);
      setSheet({ image, text, filename });
    },
    [track]
  );

  const shareRun = () => {
    const name = profile?.name ?? me.name;
    const headline = runHeadline(t, run.mode, run.outcome, run.time, me.score);
    openShare({
      image: renderRunCard({ t, name, mode: run.mode, outcome: run.outcome, time: run.time, score: me.score, history }),
      text: `${headline} · XTATS ${fmt(me.score)}\n#XTATS xtats.app`,
      filename: `xtats-${run.mode}.png`,
    });
  };

  const wipe = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(METRICS_KEY);
    } catch {
      /* sin almacenamiento */
    }
    dispatch({ type: "WIPE" });
  };

  /* ---------- Feed ---------- */
  const feed = useMemo(() => {
    const all = [...myPosts.map((p) => ({ ...p, isOwn: true })), ...POSTS.filter((p) => !state.blocked.includes(p.userId))];
    const q = normalize(query.trim());
    if (!q) return all;
    return all.filter((p) => normalize(p.isOwn ? me.name : users[p.userId].name).includes(q));
  }, [query, users, myPosts, me.name, state.blocked]);

  /* ---------- Filtro estético ---------- */
  const noFilter = (inPrison && onboarded) || sincere;
  const isPink = skin === "pink";
  const warnPlay = isWarning && tab === "play";
  const dreamFilter = noFilter
    ? "none"
    : isPink
      ? warnPlay
        ? "brightness(0.95) contrast(0.88) saturate(0.45) sepia(0.06)"
        : "brightness(1.08) contrast(0.9) saturate(0.85) sepia(0.08) hue-rotate(-6deg)"
      : warnPlay
        ? "grayscale(0.45)"
        : "none";
  const meView = { ...me, photo: myPhoto };

  const ctx = useMemo(() => ({ t, pushToast, sfx, track, userId, cloud, reloadCloud, login, logout, myPhoto }), [t, pushToast, sfx, track, userId, cloud, reloadCloud, login, logout, myPhoto]);
  const climbEnded = run.mode === "climb" && (run.outcome === "elite" || run.outcome === "timeout");

  return (
    <AppCtx.Provider value={ctx}>
      <div data-skin={skin} className="min-h-[100dvh] w-full bg-gradient-to-br from-rose-50 via-white to-slate-100 sm:flex sm:items-center sm:justify-center sm:p-4" style={isPink ? { fontFamily: FONT } : undefined}>
        <style>{GLOBAL_CSS}</style>

        {/* En celulares reales ocupa toda la pantalla; en escritorio se ve el marco del teléfono */}
        <div className="relative h-[100dvh] w-full sm:h-[820px] sm:w-[390px] sm:max-w-full sm:rounded-[3rem] sm:bg-[#111827] sm:p-3 sm:shadow-2xl sm:shadow-slate-400/40">
          <div className="absolute left-1/2 top-3 z-[60] hidden h-7 w-32 -translate-x-1/2 rounded-b-2xl bg-[#111827] sm:block" />

          <div
            onPointerDownCapture={onAnyPointer}
            className={cx("relative h-full w-full overflow-hidden bg-screen sm:rounded-[2.4rem]", anxious && "nd-shake")}
            style={{ filter: dreamFilter, transition: "filter 1.2s ease" }}
          >
            {!noFilter && skin === "black" && <div className="nd-scanlines pointer-events-none absolute inset-0 z-40 opacity-25" />}
            {!noFilter && isPink && (
              <>
                <div className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-b from-white/30 via-pink-50/10 to-white/25 mix-blend-screen" />
                <div className="pointer-events-none absolute inset-0 z-40 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.35),transparent_60%)]" />
              </>
            )}
            <div className={cx("pointer-events-none absolute inset-0 z-30 bg-slate-500 transition-opacity duration-1000", isWarning && tab === "play" && !noFilter ? "opacity-20" : "opacity-0")} />

            <div className="absolute inset-0 overflow-y-auto pb-24 [scrollbar-width:none]">
              <div className="flex items-center justify-between px-6 pb-2 pt-3 text-xs font-medium text-slate-500">
                <Logo />
                <div className="flex items-center gap-2">
                  <LangSwitch lang={lang} onChange={setLang} />
                  {onboarded && (
                    <button
                      type="button"
                      onClick={() => setAccount(true)}
                      aria-label={t.account.open}
                      className={cx("grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-pink-200 to-rose-100 text-[11px] font-semibold text-pink-500", userId ? "ring-2 ring-pink-300" : "ring-1 ring-slate-200")}
                    >
                      {myPhoto ? <img src={myPhoto} alt="" className="h-full w-full object-cover" /> : (profile?.name ?? "?").slice(0, 1).toUpperCase()}
                    </button>
                  )}
                  <button onClick={() => setSoundOn((s) => !s)} className="text-sm" aria-label={t.soundAria} aria-pressed={soundOn}>
                    {soundOn ? "🔊" : "🔇"}
                  </button>
                </div>
              </div>

              {tab === "play" && (isWarning || cascade) && !isLocked && runActive && (
                <div className="nd-pop sticky top-0 z-20 mx-4 mb-2 space-y-1 rounded-2xl bg-slate-600/90 px-4 py-3 text-xs text-white shadow-lg backdrop-blur">
                  {isWarning && <p>{t.banners.warning}</p>}
                  {isExpensive && <p>{t.banners.expensive}</p>}
                  {cascade && <p className="nd-blink">{t.banners.cascade}</p>}
                </div>
              )}

              <main className="space-y-4 px-4 pb-8 pt-1">
                {tab === "today" && <TodayTab state={state} dispatch={dispatch} metrics={{ values: metricsValues, track }} openShare={openShare} goPlay={() => setTab("play")} onHelp={() => setHowto(true)} />}

                {tab === "camera" && <CameraTab name={profile?.name ?? me.name} score={me.score} openShare={openShare} />}

                {tab === "challenges" && <ChallengesTab data={chal} myName={cloud.profile?.name ?? profile?.name ?? me.name} onNew={() => setNewDare(true)} onAction={dareAction} />}

                {tab === "friends" && <FriendsTab state={state} dispatch={dispatch} />}

                {tab === "play" && (
                  <>
                    <ModeBar run={run} records={records} onChange={() => setPicker(true)} onHelp={() => setHowto(true)} />

                    <section className={cx(S.card, "relative p-5 text-center")}>
                      <button onClick={shareRun} className="absolute right-4 top-4 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-pink-500 ring-1 ring-pink-100" aria-label={t.share.share}>
                        ↗ {t.share.share}
                      </button>
                      <div className="flex justify-center">
                        <Avatar person={meView} size="h-20 w-20 text-4xl" />
                      </div>
                      <h1 className="mt-3 font-medium text-slate-700">{me.name}</h1>
                      <p className={S.muted}>
                        {me.handle} · {t.votesCount(me.votes)}
                      </p>
                      <p key={me.score} className={cx("mt-2 text-7xl font-extralight tabular-nums", isWarning ? "text-slate-400" : "text-pink-400", trend === "up" && "nd-glow", trend === "down" && "nd-shake")}>
                        {fmt(me.score)}
                      </p>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <span className={cx(S.pill, influence.tone)}>{t.influence[influence.key]}</span>
                        {isElite && <span className={cx(S.pill, "bg-amber-50 text-amber-500")}>{t.elitePill}</span>}
                      </div>
                    </section>

                    <TrendChart history={history} votes={me.votes} />

                    <section className="grid grid-cols-2 gap-3">
                      <button onClick={receiveRandomRating} disabled={complaining || !runActive} className={cx(S.btn, S.btnPrimary)}>
                        {t.btnRandom}
                      </button>
                      <button onClick={complain} disabled={complaining || !runActive} className={cx(S.btn, S.btnDanger)}>
                        {complaining ? t.btnJudged : t.btnComplain}
                      </button>
                    </section>

                    <Composer onPublish={publish} />
                    <Services score={me.score} />

                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">⌕</span>
                      <input id="xt-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search} className={cx(S.field, "py-3 pl-11 pr-4")} />
                    </div>

                    <section className="space-y-4">
                      <p className={S.label}>{t.feed}</p>
                      {feed.length === 0 && <p className={cx(S.muted, "py-6 text-center")}>{t.noMatch(query)}</p>}
                      {feed.map((post) =>
                        post.isOwn ? (
                          <PostCard key={post.id} post={post} text={post.text} author={meView} isOwn time={new Date(post.ts).toLocaleTimeString(t.locale, { hour: "2-digit", minute: "2-digit" })} />
                        ) : (
                          <PostCard
                            key={post.id}
                            post={post}
                            text={t.posts[post.id][0]}
                            author={users[post.userId]}
                            time={t.posts[post.id][1]}
                            myRating={rated[post.id]}
                            onRate={(n) => ratePost(post, n)}
                            onReport={() => {
                              dispatch({ type: "REPORT", postId: post.id });
                              if (userId) remote.report(userId, post.id).catch(() => {});
                              pushToast("toast", "reported", "good");
                            }}
                            onBlock={() => {
                              dispatch({ type: "BLOCK", userId: post.userId });
                              pushToast("toast", "blocked", "good");
                            }}
                          />
                        )
                      )}
                    </section>

                    <ActivityLog entries={log} />

                    <button onClick={() => startRun(run.mode)} className={cx(S.btn, S.btnGhost)}>
                      {t.result.playAgain}
                    </button>
                  </>
                )}
              </main>
            </div>

            {onboarded && <TabBar tab={tab} setTab={setTab} badges={{ challenges: pendingDares }} />}
            <Toasts items={toasts} />
            {showElite && !isLocked && tab === "play" && <SuccessOverlay />}
            {onboarded && isLocked && !inPrison && runActive && <LockScreen score={me.score} />}
            {onboarded && climbEnded && <RunResult run={run} records={records} onAgain={() => startRun("climb")} onShare={shareRun} onHome={() => (startRun("free"), setTab("today"))} />}
            {onboarded && inPrison && !sincere && <PrisonScreen run={run} records={records} onRestart={() => startRun(run.mode)} onSincere={() => setSincere(true)} onShare={shareRun} />}
            {onboarded && sincere && <SincereScreen posts={state.sincere} onPost={(text) => dispatch({ type: "SINCERE_POST", text, meta: meta() })} onExit={() => startRun(run.mode)} />}
            {account && (
              <AccountSheet
                name={cloud.profile?.name ?? profile?.name ?? me.name}
                email={session?.user?.email}
                provider={session?.user?.app_metadata?.provider}
                photo={myPhoto}
                skin={skin}
                onSkin={setSkin}
                onPhoto={setPhoto}
                onClose={() => setAccount(false)}
              />
            )}
            {newDare && (
              <NewChallengeSheet
                myName={cloud.profile?.name ?? profile?.name ?? me.name}
                onClose={() => setNewDare(false)}
                onSent={() => {
                  setNewDare(false);
                  reloadChallenges();
                }}
              />
            )}
            {picker && <ModePicker records={records} onPick={startRun} onClose={() => setPicker(false)} onHelp={() => setHowto(true)} />}
            {howto && <HowToSheet current={run.mode} onClose={() => setHowto(false)} />}
            {sheet && <ShareSheet {...sheet} onClose={() => setSheet(null)} />}
            {!profile && !underage && <Onboarding lang={lang} setLang={setLang} onDone={(name) => (dispatch({ type: "ONBOARD", name }), setHowto(true))} onUnderage={() => dispatch({ type: "UNDERAGE" })} />}
            {underage && <Underage onWipe={wipe} />}
          </div>
        </div>
      </div>
    </AppCtx.Provider>
  );
}

/* =========================================================================
   CSS GLOBAL
   ========================================================================= */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');
${SKIN_CSS}
@keyframes nd-pop { 0% { transform: scale(.85); opacity: 0 } 60% { transform: scale(1.03); opacity: 1 } 100% { transform: scale(1) } }
@keyframes nd-shake { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-6px) } 40% { transform: translateX(6px) } 60% { transform: translateX(-4px) } 80% { transform: translateX(4px) } }
@keyframes nd-glow { 0% { text-shadow: 0 0 0 rgba(244,114,182,0); transform: scale(1) } 40% { text-shadow: 0 0 24px rgba(244,114,182,.7); transform: scale(1.06) } 100% { text-shadow: 0 0 0 rgba(244,114,182,0); transform: scale(1) } }
@keyframes nd-float { 0% { transform: translateY(0) scale(.8); opacity: 0 } 20% { opacity: 1 } 100% { transform: translateY(-140px) scale(1.2); opacity: 0 } }
@keyframes nd-hover { 0%,100% { transform: translate(-50%, 0) } 50% { transform: translate(-50%, -6px) } }
@keyframes nd-blink { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
@keyframes nd-toast { 0% { transform: translateY(-12px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
@keyframes nd-sheet { 0% { transform: translateY(40px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }
@keyframes nd-glitch-in {
  0% { filter: invert(1) hue-rotate(90deg); transform: translateX(-8px) skewX(8deg); clip-path: inset(10% 0 60% 0) }
  10% { filter: none; transform: translateX(8px); clip-path: inset(50% 0 20% 0) }
  20% { filter: invert(1); transform: translateX(-4px) skewX(-6deg); clip-path: inset(0 0 80% 0) }
  30% { filter: none; transform: none; clip-path: inset(30% 0 30% 0) }
  45% { clip-path: inset(0 0 0 0); transform: translateX(3px) }
  60%,100% { transform: none; clip-path: inset(0 0 0 0) }
}
@keyframes nd-glitch-text {
  0%,92%,100% { text-shadow: 2px 0 rgba(244,63,94,.7), -2px 0 rgba(56,189,248,.6); transform: none }
  94% { text-shadow: -4px 0 rgba(244,63,94,.9), 4px 0 rgba(56,189,248,.9); transform: translateX(2px) skewX(10deg) }
  96% { text-shadow: 4px 0 rgba(244,63,94,.9), -4px 0 rgba(56,189,248,.9); transform: translateX(-2px) }
}
.nd-pop { animation: nd-pop .45s ease-out both }
.nd-shake { animation: nd-shake .5s ease-in-out }
.nd-glow { animation: nd-glow .9s ease-out }
.nd-float { animation: nd-float 2.2s ease-out infinite }
.nd-hover { animation: nd-hover 3s ease-in-out infinite }
.nd-blink { animation: nd-blink 1.4s ease-in-out infinite }
.nd-toast { animation: nd-toast .35s ease-out both }
.nd-sheet { animation: nd-sheet .3s ease-out both }
.nd-glitch-in { animation: nd-glitch-in 1.1s steps(1, end) both }
.nd-glitch { animation: nd-glitch-text 3s infinite }
.nd-scanlines { background: repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 3px) }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important } }
`;
