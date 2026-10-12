/** Pestaña Jugar: feed, gráfico, servicios, historial y pantallas de consecuencia. */
import { useEffect, useMemo, useState } from "react";
import { MODES, RECORD_MODES, SERVICES, T } from "../game/config.js";
import { analyzeText, cx, fmt, fmtTime, moderate, money, round2 } from "../game/engine.js";
import { logText } from "../game/state.js";
import { Avatar, S, ScorePill, StarRating, useApp } from "./common.jsx";

export function PostCard({ post, text, author, time, myRating, onRate, isOwn, onReport, onBlock }) {
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

export function Composer({ onPublish }) {
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

export function TrendChart({ history, votes }) {
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

export function Services({ score }) {
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

export function ActivityLog({ entries }) {
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

export function Toasts({ items }) {
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

export function SuccessOverlay() {
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

export function LockScreen({ score }) {
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
export function PrisonScreen({ run, records, onRestart, onSincere, onShare }) {
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
export function SincereScreen({ posts, onPost, onExit }) {
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
export function RunResult({ run, records, onAgain, onShare, onHome }) {
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
export function ModeBar({ run, records, onChange, onHelp }) {
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
