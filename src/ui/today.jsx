import { useEffect, useMemo, useRef, useState } from "react";
import { DAILY_EFFECTS, INITIAL_ME } from "../game/config.js";
import { cx, dateKey, dayNumber, fmt, fmtTime, lastDays, pad, scenarioFor } from "../game/engine.js";
import { demo } from "../game/state.js";
import { renderDailyCard, renderWeekCard } from "../lib/cards.js";
import { Avatar, S, ScorePill, useApp } from "./common.jsx";

export function Countdown() {
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
export function DailyChallenge({ entry, onPick, onShare }) {
  const { t, sfx } = useApp();
  const key = dateKey();
  const scenario = entry?.scenario ?? scenarioFor(key);
  const sc = t.daily.scenarios[scenario];
  const picks = entry?.picks ?? [];
  const step = picks.length;
  const [flash, setFlash] = useState(null);
  const { userId, cloud } = useApp();
  const demoFriends = useMemo(() => demo.getFriendsDaily(key), [key]);
  const friends = userId ? cloud.friends.filter((f) => f.score != null) : demoFriends;

  // Un toque doble rápido no debe responder también la pregunta siguiente
  const answered = useRef(null);
  const flashTimer = useRef(null);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const choose = (opt) => {
    if (answered.current === `${key}:${step}`) return;
    answered.current = `${key}:${step}`;
    sfx.unlock();
    const stars = DAILY_EFFECTS[scenario][step][opt][0];
    if (stars >= 4) sfx.playHarp();
    else if (stars <= 2) sfx.playThud();
    setFlash(stars);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 900);
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
export function useWeek(state, t) {
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

export function TodayTab({ state, dispatch, metrics, openShare, goPlay, onHelp }) {
  const { t } = useApp();
  const week = useWeek(state, t);
  const entry = state.daily[dateKey()];
  const name = state.profile?.name ?? INITIAL_ME.name;
  const shareDaily = (e, title) => {
    const n = dayNumber();
    openShare({
      image: renderDailyCard({ t, n, title, score: e.score, grid: e.grid }),
      text: `XTATS · ${t.daily.title(n)}\n${fmt(e.score)} ${e.grid}\n#XTATS xtats.us`,
      filename: `xtats-reto-${n}.png`,
      event: "dailyShares",
    });
  };
  const shareWeek = () =>
    openShare({
      image: renderWeekCard({ t, name, rows: week.slice(0, 6) }),
      text: `${t.week.label} · ${week.map(([k, v]) => `${k}: ${v}`).slice(0, 3).join(" · ")}\n#XTATS xtats.us`,
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
