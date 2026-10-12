import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "./config.js";
import { initialState, loadState, reducer } from "./state.js";

const meta = { id: "x", ts: 1 };
const vip = { key: "influencer", score: 4.8 };

function onboarded() {
  return reducer(initialState(), { type: "ONBOARD", name: "Ana" });
}

describe("reducer", () => {
  it("recibir 1★ de un VIP baja el puntaje y lo registra", () => {
    const s = reducer(onboarded(), { type: "RECEIVE_RATING", rater: vip, stars: 1, reason: "toxic", meta });
    expect(s.me.score).toBeLessThan(4.1);
    expect(s.log[0]).toMatchObject({ type: "received", tone: "down" });
    expect(s.history.at(-1).s).toBe(s.me.score);
  });

  it("con la partida terminada el puntaje queda congelado", () => {
    let s = onboarded();
    s = { ...s, me: { ...s.me, score: 0.1 } };
    s = reducer(s, { type: "END_RUN", outcome: "prison", now: s.run.startedAt + 5000 });
    const after = reducer(s, { type: "RECEIVE_RATING", rater: vip, stars: 5, meta });
    expect(after).toBe(s);
    expect(reducer(s, { type: "PENALTY", amount: 0.05, meta })).toBe(s);
  });

  it("guarda el récord solo si es mejor", () => {
    let s = reducer(onboarded(), { type: "START_RUN", mode: "speedrun" });
    const t0 = s.run.startedAt;
    s = reducer(s, { type: "END_RUN", outcome: "prison", now: t0 + 30000 });
    expect(s.records.speedrun).toBe(30000);
    s = reducer(s, { type: "START_RUN", mode: "speedrun" });
    s = reducer(s, { type: "END_RUN", outcome: "prison", now: s.run.startedAt + 45000 });
    expect(s.records.speedrun).toBe(30000);
    expect(s.run.newRecord).toBe(false);
  });

  it("no se puede calificar dos veces la misma publicación", () => {
    const once = reducer(onboarded(), { type: "RATE_POST", postId: "p1", userId: "valentina", stars: 5, meta });
    expect(reducer(once, { type: "RATE_POST", postId: "p1", userId: "valentina", stars: 1, meta })).toBe(once);
  });

  it("el reto diario acepta exactamente 3 respuestas", () => {
    let s = onboarded();
    for (let i = 0; i < 4; i++) s = reducer(s, { type: "DAILY_PICK", date: "2026-10-12", scenario: 0, option: 0 });
    expect(s.daily["2026-10-12"].picks).toHaveLength(3);
    expect(s.daily["2026-10-12"].done).toBe(true);
  });
});

describe("loadState", () => {
  beforeEach(() => localStorage.clear());

  it("descarta datos corruptos o de un modo que ya no existe", () => {
    localStorage.setItem(STORAGE_KEY, "{no es json");
    expect(loadState().profile).toBeNull();
    const old = { ...onboarded(), run: { ...onboarded().run, mode: "lacie" } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
    expect(loadState().profile).toBeNull();
  });

  it("recupera una partida guardada y completa campos nuevos", () => {
    const saved = onboarded();
    delete saved.records.climb;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const s = loadState();
    expect(s.profile).toEqual({ name: "Ana" });
    expect(s.records).toHaveProperty("climb", null);
  });
});
