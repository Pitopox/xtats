/** Estilos compartidos, contexto y piezas básicas de la interfaz. */
import { createContext, useContext, useState } from "react";
import { FaFacebook } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { cx, fmt, scoreTone } from "../game/engine.js";
import { LANGS } from "../i18n.js";

/* =========================================================================
   8. COMPONENTES
   ========================================================================= */
export const S = {
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
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function Logo() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-gradient-to-br from-pink-300 to-rose-400" />
      <span className="text-sm font-light tracking-[0.45em] text-slate-600">XTATS</span>
    </div>
  );
}

export function LangSwitch({ lang, onChange }) {
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

export function Avatar({ person: p, size = "h-10 w-10 text-xl" }) {
  return <div className={cx(S.avatar, p.gradient, size, "overflow-hidden")}>{p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : p.avatar}</div>;
}

/** Botón de acceso con el ícono oficial de Google o Facebook (react-icons). */
export const PROVIDER_ICON = { google: FcGoogle, facebook: FaFacebook };
export function ProviderButton({ provider, label, onClick, disabled, compact }) {
  const Icon = PROVIDER_ICON[provider];
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cx(S.btn, S.btnGhost, "flex items-center justify-center gap-2", compact && "py-2")}>
      <Icon aria-hidden="true" className={cx("h-5 w-5 shrink-0", provider === "facebook" && "text-[#1877F2]")} />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function ScorePill({ score }) {
  return <span className={cx(S.pill, scoreTone(score))}>★ {fmt(score)}</span>;
}

export function StarRating({ value = 0, onRate, disabled }) {
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
