/** Estado de la partida: reducer puro, persistencia y textos del historial. */
import { FRIENDS, HISTORY_MAX, INITIAL_ME, INITIAL_USERS, MAX_LOG, MODES, STORAGE_KEY, T } from "./config.js";
import { dailyOutcome, dateKey, fmt, hashStr, impactKey, isBetter, meta, nameOf, normalize, rateWith, round2, scenarioFor, seeded } from "./engine.js";

/* =========================================================================
   5. ESTADO (reducer puro) + PERSISTENCIA
   ========================================================================= */
export function freshRun(mode, name) {
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

export const initialState = () => ({
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

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const saved = JSON.parse(raw);
    // Datos de otra versión o corruptos: se descartan en vez de romper la app
    if (!saved?.me || !saved?.run || !MODES[saved.run.mode] || !Number.isFinite(saved.me.score)) return initialState();
    const base = initialState();
    return { ...base, ...saved, records: { ...base.records, ...saved.records }, users: { ...base.users, ...saved.users } };
  } catch {
    return initialState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* sin almacenamiento */
  }
}

export const pushLog = (log, entry) => [entry, ...log].slice(0, MAX_LOG);
export const bumpDay = (days, key, field, n = 1) => {
  const d = days[key] ?? { runs: 0, prisons: 0, elites: 0, posts: 0 };
  return { ...days, [key]: { ...d, [field]: (d[field] ?? 0) + n } };
};

export function commitMe(state, me, entry) {
  const changed = me.score !== state.me.score;
  return {
    ...state,
    me,
    history: changed ? [...state.history, { t: entry.ts, s: me.score }].slice(-HISTORY_MAX) : state.history,
    log: pushLog(state.log, entry),
  };
}

export function reducer(state, action) {
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
      // Con la partida terminada el puntaje queda congelado (evita salir de la cárcel por un voto tardío)
      if (state.run.endedAt) return state;
      const { rater, stars, reason } = action;
      const me = rateWith(state.me, stars, rater.score);
      const delta = round2(me.score - state.me.score);
      return commitMe(state, me, { ...m, tone: delta < 0 ? "down" : delta > 0 ? "up" : "neutral", type: "received", p: { rater, stars, reason, delta } });
    }

    case "PENALTY": {
      if (state.run.endedAt) return state;
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

export function logText(e, t) {
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
export const demo = {
  /** Amigos del grupo con sus récords (simulados en la demo). */
  getFriends: () => FRIENDS,
  /** Puntajes del reto diario de los amigos para una fecha (simulados con semilla). */
  getFriendsDaily: (key) => {
    const rnd = seeded(hashStr(`friends-${key}`));
    return FRIENDS.map((f) => ({ ...f, score: round2(1.6 + rnd() * 3.3) }));
  },
};
