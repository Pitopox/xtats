/** Hojas inferiores: modos, guía, cuenta y compartir. */
import { useEffect, useRef, useState } from "react";
import { FaInstagram, FaTiktok } from "react-icons/fa";
import { remote } from "../backend.js";
import { MODE_ICON, MODE_ORDER, RECORD_MODES } from "../game/config.js";
import { cx, fmt, fmtTime } from "../game/engine.js";
import { dataUrlToBlob, fileToSquareJpeg } from "../lib/cards.js";
import { SKINS } from "../skins.js";
import { Avatar, ProviderButton, S, useApp } from "./common.jsx";

/** Hoja para elegir modo de juego. */
export function ModePicker({ records, onPick, onClose, onHelp }) {
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
export function HowToSheet({ current, onClose }) {
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
export function AccountSheet({ name, email, provider, photo, skin, onSkin, onPhoto, onClose }) {
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

/** Hoja para compartir: imagen hacia Instagram/TikTok (menú del sistema), dentro de XTATS, descarga o texto. */
export function ShareSheet({ image, text, filename, onClose, onInApp, inAppDone = false }) {
  const { t, track, pushToast } = useApp();
  const [copied, setCopied] = useState(false);
  const [inApp, setInApp] = useState(inAppDone);
  const [busy, setBusy] = useState(false);
  const textRef = useRef(null);
  useEffect(() => track("views"), [track]);

  // En el celular abre el menú de compartir (ahí aparecen Instagram y TikTok); si no se puede, descarga
  const share = async () => {
    try {
      const file = new File([dataUrlToBlob(image)], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        track("shares");
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
    if (await download()) pushToast("toast", "imageSaved", "good");
  };
  const download = async () => {
    // Dentro de claude.ai la descarga pasa por la capacidad `downloads`; en Vite, por un enlace normal
    const downloads = window.claude?.use ? await window.claude.use("downloads").catch(() => null) : null;
    if (downloads) {
      try {
        await downloads.save({ filename, data: dataUrlToBlob(image) });
        track("downloads");
        return true;
      } catch {
        return false;
      }
    }
    const a = document.createElement("a");
    a.href = image;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    track("downloads");
    return true;
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
  const shareInApp = async () => {
    setBusy(true);
    try {
      await onInApp();
      setInApp(true);
      pushToast("toast", "sharedInApp", "good");
    } catch {
      pushToast("toast", "dareFailed", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[58] flex flex-col justify-end bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose}>
      <div className="nd-sheet max-h-[92%] space-y-3 overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" />
        <p className={S.label}>{t.share.title}</p>
        <img src={image} alt={text} className="mx-auto max-h-[40vh] w-auto max-w-full rounded-2xl shadow-lg ring-1 ring-pink-100 sm:max-h-72" />
        {onInApp && (
          <button onClick={shareInApp} disabled={inApp || busy} className={cx(S.btn, inApp ? S.btnGhost : S.btnPrimary)}>
            {inApp ? t.share.inAppDone : busy ? "…" : `★ ${t.share.inApp}`}
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={share} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] px-4 py-3 text-sm font-semibold text-[#fff] transition active:scale-[0.98]">
            <FaInstagram className="h-5 w-5" aria-hidden="true" /> {t.share.instagram}
          </button>
          <button onClick={share} className="flex items-center justify-center gap-2 rounded-2xl bg-[#000] px-4 py-3 text-sm font-semibold text-[#fff] transition active:scale-[0.98]">
            <FaTiktok className="h-5 w-5" aria-hidden="true" /> {t.share.tiktok}
          </button>
        </div>
        <p className="text-center text-[10px] leading-relaxed text-slate-400">{t.share.socialHint}</p>
        <textarea ref={textRef} readOnly value={text} rows={2} className={cx(S.field, "resize-none p-2 text-xs")} aria-label={t.share.copy} />
        <div className="grid grid-cols-2 gap-2">
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
