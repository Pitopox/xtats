import { useCallback, useRef } from "react";

/* =========================================================================
   6. AUDIO Y VIBRACIÓN
   ========================================================================= */
export const vibrate = (pattern) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* no soportado */
  }
};

export function useSynth(enabledRef) {
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
