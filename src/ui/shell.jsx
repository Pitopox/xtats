/** Inicio, verificación de edad y barra de pestañas. */
import { useState } from "react";
import { FiCamera, FiFlag, FiStar, FiSun, FiUsers } from "react-icons/fi";
import { remote } from "../backend.js";
import { MIN_AGE } from "../game/config.js";
import { cx } from "../game/engine.js";
import { LangSwitch, Logo, ProviderButton, S, useApp } from "./common.jsx";

/** Primera vez: idioma, nombre, edad mínima y aviso de sátira. */
export function Onboarding({ lang, setLang, onDone, onUnderage }) {
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

export function Underage({ onWipe }) {
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

export function TabBar({ tab, setTab, badges = {} }) {
  const { t } = useApp();
  const items = [
    ["today", FiSun],
    ["play", FiStar],
    ["camera", FiCamera],
    ["challenges", FiFlag],
    ["friends", FiUsers],
  ];
  return (
    <nav className="absolute inset-x-0 bottom-0 z-[45] border-t border-slate-200/70 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur" aria-label="XTATS">
      <ul className="grid grid-cols-5 px-1">
        {items.map(([id, Icon]) => {
          const on = tab === id;
          return (
            <li key={id}>
              <button type="button" onClick={() => setTab(id)} aria-current={on ? "page" : undefined} className={cx("flex w-full flex-col items-center gap-1 pb-2 pt-2 text-[11px] font-medium transition", on ? "text-pink-500" : "text-slate-500 hover:text-slate-700")}>
                <span className={cx("relative grid h-7 w-12 place-items-center rounded-full transition", on && "bg-pink-100")}>
                  <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={on ? 2.2 : 1.8} />
                  {badges[id] > 0 && <span className="absolute -right-0.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">{badges[id]}</span>}
                </span>
                {t.tabs[id]}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
