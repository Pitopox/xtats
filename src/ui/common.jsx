/** Estilos compartidos, contexto y piezas básicas de la interfaz. */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { FaFacebook } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { FiX } from "react-icons/fi";
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
  label: "text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500",
  muted: "text-xs text-slate-500",
  hint: "text-[11px] leading-snug text-slate-500",
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

/** Cierra una hoja con la tecla Escape. */
export function useEscape(onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && ref.current?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * Hoja inferior común: fondo oscurecido, cierre con Escape, toque fuera o botón X,
 * y título visible para que siempre quede claro dónde estás.
 */
export function Sheet({ title, onClose, children, z = "z-[57]", className = "space-y-4" }) {
  const { t } = useApp();
  useEscape(onClose);
  return (
    <div className={cx("absolute inset-0 flex flex-col justify-end bg-slate-900/25 backdrop-blur-[2px]", z)} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx("nd-sheet max-h-[92%] overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-8 shadow-2xl", className)} onClick={(e) => e.stopPropagation()}>
        <div className="sticky -top-5 z-10 -mx-5 -mt-5 flex items-center justify-between gap-3 bg-white/95 px-5 pb-2 pt-4 backdrop-blur">
          <h2 className="text-base font-semibold text-slate-700">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t.close} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700">
            <FiX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
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
    <div className="-ml-1.5 flex" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onMouseEnter={() => !disabled && setHover(n)}
          onClick={() => onRate(n)}
          aria-label={t.starsAria(n)}
          className={cx("grid h-10 w-9 place-items-center text-[1.65rem] leading-none transition", n <= shown ? "text-pink-300 drop-shadow-[0_0_6px_rgba(249,168,212,0.8)]" : "text-slate-300", disabled ? "cursor-default" : "hover:scale-125")}
        >
          ★
        </button>
      ))}
    </div>
  );
}
