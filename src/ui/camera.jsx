/** Filtro de cámara: puntaje flotando sobre la cabeza. */
import { useCallback, useEffect, useRef, useState } from "react";
import { cx, fmt } from "../game/engine.js";
import { composePhoto } from "../lib/cards.js";
import { S, useApp } from "./common.jsx";

export function CameraTab({ name, score, openShare }) {
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
    openShare({ image, text: `${name} ★ ${fmt(score)} · XTATS\n#XTATS xtats.us`, filename: "xtats-filtro.png" });
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
