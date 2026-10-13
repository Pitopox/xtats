/**
 * XTATS v4 — "Sonríe. Sobrevive al algoritmo."
 * Sátira jugable sobre vivir bajo calificaciones sociales. React + Tailwind CSS.
 *
 * Este archivo orquesta la partida (cascada, paranoia, ansiedad, modos y
 * consecuencias), la sesión de Supabase y los retos. El resto vive en:
 *  game/   configuración, motor de puntaje y reducer (funciones puras, con pruebas)
 *  lib/    audio, tarjetas 9:16 y métricas
 *  ui/     componentes por pestaña y hojas inferiores
 *
 * Con VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY definidas, el login
 * (Google/Meta), los amigos, los récords y el reto diario usan Supabase
 * (src/backend.js + supabase/schema.sql). Sin ellas, todo funciona en modo demo.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { remote } from "./backend.js";
import { ANXIETY, CASCADE_MS, LANG_KEY, METRICS_KEY, MODES, PARANOIA, PENDING_KEY, POSTS, RESENTFUL_BOTS, SKIN_KEY, STORAGE_KEY, STRANGERS, SYSTEM, T, VIP_BOTS } from "./game/config.js";
import { analyzeText, cx, dateKey, fmt, influenceKey, meta, moderate, normalize, pick, randomStars, round2 } from "./game/engine.js";
import { loadState, reducer, saveState } from "./game/state.js";
import { I18N, LANGS } from "./i18n.js";
import { useSynth } from "./lib/audio.js";
import { FONT, dataUrlToBlob, renderDareCard, renderRunCard, runHeadline } from "./lib/cards.js";
import { useMetrics } from "./lib/metrics.js";
import { SKINS } from "./skins.js";
import { CameraTab } from "./ui/camera.jsx";
import { ChallengesTab, NewChallengeSheet, dareState } from "./ui/challenges.jsx";
import { FiSearch, FiShare2, FiVolume2, FiVolumeX } from "react-icons/fi";
import { AppCtx, Avatar, Logo, S } from "./ui/common.jsx";
import { FriendsTab } from "./ui/friends.jsx";
import { ActivityLog, Composer, LastChange, LockScreen, ModeBar, PostCard, PrisonScreen, RunResult, ScoreActions, Services, SincereScreen, SuccessOverlay, Toasts, TrendChart } from "./ui/play.jsx";
import { AccountSheet, HowToSheet, ModePicker, ShareSheet, WelcomeSheet } from "./ui/sheets.jsx";
import { Onboarding, TabBar, Underage } from "./ui/shell.jsx";
import { TodayTab } from "./ui/today.jsx";

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
  const [welcome, setWelcome] = useState(false);
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
  const [shares, setShares] = useState([]);
  const [newDare, setNewDare] = useState(false);
  const [skin, setSkin] = useState(() => {
    try {
      const v = localStorage.getItem(SKIN_KEY);
      return SKINS.includes(v) ? v : "white";
    } catch {
      return "white";
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
  // Durante la cascada el estado cambia cada ~1 s: se guarda agrupado y se fuerza al salir de la página
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const id = setTimeout(() => saveState(state), 300);
    return () => clearTimeout(id);
  }, [state]);
  useEffect(() => {
    const flush = () => saveState(stateRef.current);
    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);
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
    remote.getSession().then(setSession).catch(() => {});
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
    if (!userId) {
      setShares([]);
      return setChal({ received: [], sent: [], people: {}, loading: false });
    }
    setChal((c) => ({ ...c, loading: true }));
    try {
      const [d, sh] = await Promise.all([remote.loadChallenges(userId), remote.loadShares().catch(() => null)]);
      setChal({ ...d, loading: false });
      if (sh) setShares(sh);
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
    // Sin consultas mientras la app está en segundo plano; al volver se refresca de inmediato
    const id = setInterval(() => document.visibilityState === "visible" && reloadChallenges(), 30000);
    const onVisible = () => document.visibilityState === "visible" && reloadChallenges();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tab, userId, reloadChallenges, reloadCloud]);

  const dareAction = async (kind, id) => {
    try {
      await remote.respondChallenge(id, kind === "accept");
      pushToast("toast", kind === "accept" ? "dareAccepted" : "dareDeclined", "good");
      if (kind === "accept") sfx.playHarp();
    } catch {
      pushToast("toast", "dareFailed", "danger");
    }
    reloadChallenges();
  };
  const darePost = async (challengeId, body, blob) => {
    try {
      await remote.addChallengePost(challengeId, userId, body, blob);
      pushToast("toast", "postAdded", "good");
      reloadChallenges();
      return true;
    } catch {
      pushToast("toast", "postFailed", "danger");
      return false;
    }
  };
  const dareDeletePost = async (post) => {
    try {
      await remote.deleteChallengePost(post);
    } catch {
      pushToast("toast", "dareFailed", "danger");
    }
    reloadChallenges();
  };
  const dareRate = async (challengeId, recipient, stars) => {
    try {
      await remote.rateChallenge(challengeId, recipient, stars);
      pushToast("toast", "rated", "good");
      if (stars >= 4) sfx.playHarp();
      else if (stars <= 2) sfx.playThud();
    } catch {
      pushToast("toast", "rateFailed", "danger");
    }
    reloadChallenges();
  };
  const dareShare = (c, sender) => {
    const name = cloud.profile?.name ?? profile?.name ?? me.name;
    const m = c.mine;
    openShare({
      image: renderDareCard({ t, skin, name, senderName: sender.name, title: c.title, stars: m.stars, before: m.score_before, after: m.score_after }),
      text: `${"★".repeat(m.stars)}${"☆".repeat(5 - m.stars)} «${c.title}» · XTATS ${fmt(m.score_after)}\n#XTATS xtats.us`,
      filename: "xtats-reto.png",
      event: "shares",
      inAppDone: !!m.shared_at,
      onInApp: async () => {
        await remote.shareChallenge(c.id);
        reloadChallenges();
      },
    });
  };
  const pendingDares =
    chal.received.filter((c) => dareState(c.mine, c.deadline, false) === "pending").length +
    chal.sent.reduce((n, c) => n + c.targets.filter((tg) => dareState(tg, c.deadline, true) === "rate").length, 0);

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

  const schedule = (fn, ms) => {
    const id = setTimeout(() => {
      timers.current = timers.current.filter((x) => x !== id);
      fn();
    }, ms);
    timers.current.push(id);
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);
  // Al terminar la partida se cancelan las calificaciones programadas (publicación, queja)
  useEffect(() => {
    if (!run.endedAt) return;
    clearTimers();
    setComplaining(false);
  }, [run.endedAt]);

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
    ({ image, text, filename, event, onInApp, inAppDone }) => {
      if (event) track(event);
      setSheet({ image, text, filename, onInApp, inAppDone });
    },
    [track]
  );

  const shareRun = () => {
    const name = profile?.name ?? me.name;
    const headline = runHeadline(t, run.mode, run.outcome, run.time, me.score);
    openShare({
      image: renderRunCard({ t, name, mode: run.mode, outcome: run.outcome, time: run.time, score: me.score, history }),
      text: `${headline} · XTATS ${fmt(me.score)}\n#XTATS xtats.us`,
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

  const ctx = useMemo(() => ({ t, lang, skin, pushToast, sfx, track, userId, cloud, reloadCloud, login, logout, myPhoto }), [t, lang, skin, pushToast, sfx, track, userId, cloud, reloadCloud, login, logout, myPhoto]);
  const climbEnded = run.mode === "climb" && (run.outcome === "elite" || run.outcome === "timeout");

  return (
    <AppCtx.Provider value={ctx}>
      <div data-skin={skin} className="min-h-[100dvh] w-full bg-gradient-to-br from-rose-50 via-white to-slate-100 sm:flex sm:items-center sm:justify-center sm:p-4" style={isPink ? { fontFamily: FONT } : undefined}>

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
              <div className="flex items-center justify-between px-5 pb-2 pt-3 text-xs font-medium text-slate-500">
                <Logo />
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setSoundOn((s) => !s)} className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" aria-label={t.soundAria} aria-pressed={soundOn} title={t.soundAria}>
                    {soundOn ? <FiVolume2 className="h-[18px] w-[18px]" aria-hidden="true" /> : <FiVolumeX className="h-[18px] w-[18px]" aria-hidden="true" />}
                  </button>
                  {onboarded && (
                    <button
                      type="button"
                      onClick={() => setAccount(true)}
                      aria-label={t.account.open}
                      title={t.account.open}
                      className={cx("grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-pink-200 to-rose-100 text-sm font-semibold text-pink-500", userId ? "ring-2 ring-pink-300" : "ring-1 ring-slate-200")}
                    >
                      {myPhoto ? <img src={myPhoto} alt="" className="h-full w-full object-cover" /> : (profile?.name ?? "?").slice(0, 1).toUpperCase()}
                    </button>
                  )}
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

                {tab === "challenges" && <ChallengesTab data={chal} shares={shares} myName={cloud.profile?.name ?? profile?.name ?? me.name} onNew={() => setNewDare(true)} onAction={dareAction} onPost={darePost} onDeletePost={dareDeletePost} onRate={dareRate} onShare={dareShare} />}

                {tab === "friends" && <FriendsTab state={state} dispatch={dispatch} />}

                {tab === "play" && (
                  <>
                    <ModeBar run={run} records={records} onChange={() => setPicker(true)} onHelp={() => setHowto(true)} />

                    <section className={cx(S.card, "relative p-5 text-center")}>
                      <button onClick={shareRun} className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-2 text-xs font-medium text-pink-500 ring-1 ring-pink-100 hover:bg-pink-100">
                        <FiShare2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t.share.share}
                      </button>
                      <div className="flex justify-center">
                        <Avatar person={meView} size="h-16 w-16 text-3xl" />
                      </div>
                      <h1 className="mt-2 font-medium text-slate-700">{me.name}</h1>
                      <p className={S.muted}>
                        {me.handle} · {t.votesCount(me.votes)}
                      </p>
                      <p className={cx(S.label, "mt-3")}>{t.yourScore}</p>
                      <p key={me.score} className={cx("text-7xl font-extralight tabular-nums", isWarning ? "text-slate-400" : "text-pink-400", trend === "up" && "nd-glow", trend === "down" && "nd-shake")}>
                        {fmt(me.score)}
                      </p>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <span className={cx(S.pill, influence.tone)}>{t.influence[influence.key]}</span>
                        {isElite && <span className={cx(S.pill, "bg-amber-50 text-amber-500")}>{t.elitePill}</span>}
                      </div>
                      <LastChange entry={log[0]} />
                    </section>

                    <ScoreActions onRandom={receiveRandomRating} onComplain={complain} complaining={complaining} disabled={!runActive} />

                    <TrendChart history={history} votes={me.votes} />

                    <Composer onPublish={publish} />

                    <section className="space-y-3">
                      <div>
                        <h2 className="text-base font-semibold text-slate-700">{t.feed}</h2>
                        <p className={S.hint}>{t.feedHint}</p>
                      </div>
                      <div className="relative">
                        <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <input id="xt-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search} className={cx(S.field, "py-3 pl-11 pr-4")} />
                      </div>
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

                    <Services score={me.score} />

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
                lang={lang}
                onLang={setLang}
                soundOn={soundOn}
                onSound={setSoundOn}
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
            {welcome && (
              <WelcomeSheet
                name={profile?.name ?? me.name}
                onStart={() => setWelcome(false)}
                onRules={() => {
                  setWelcome(false);
                  setHowto(true);
                }}
              />
            )}
            {!profile && !underage && <Onboarding lang={lang} setLang={setLang} onDone={(name) => (dispatch({ type: "ONBOARD", name }), setWelcome(true))} onUnderage={() => dispatch({ type: "UNDERAGE" })} />}
            {underage && <Underage onWipe={wipe} />}
          </div>
        </div>
      </div>
    </AppCtx.Provider>
  );
}
