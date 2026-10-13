import { describe, expect, it } from "vitest";
import { analyzeText, calculateXtatsScore, dailyOutcome, isBetter, moderate, rateWith } from "./engine.js";
import { DAILY_EFFECTS } from "./config.js";

describe("calculateXtatsScore", () => {
  it("un VIP mueve el puntaje más que alguien promedio", () => {
    const vip = calculateXtatsScore(4.0, 12, 5, 4.8).score;
    const avg = calculateXtatsScore(4.0, 12, 5, 2.5).score;
    expect(vip).toBeGreaterThan(avg);
    expect(avg).toBeGreaterThan(4.0);
  });

  it("el voto de un paria (<2.0) no cambia nada", () => {
    expect(calculateXtatsScore(4.2, 12, 1, 1.9)).toEqual({ score: 4.2, newTotalVotes: 12 });
  });

  it("1–2 estrellas pesan 1.5× más que una buena nota del mismo votante", () => {
    const down = 4.0 - calculateXtatsScore(4.0, 12, 1, 3.8).score;
    const up = calculateXtatsScore(4.0, 12, 5, 3.8).score - 4.0;
    expect(down).toBeGreaterThan(up);
  });

  it("nunca sale del rango 0.1–5.0", () => {
    let s = { score: 0.5, weight: 12 };
    for (let i = 0; i < 200; i++) s = rateWith(s, 0, 5);
    expect(s.score).toBe(0.1);
    s = { score: 4.9, weight: 12 };
    for (let i = 0; i < 200; i++) s = rateWith(s, 5, 5);
    expect(s.score).toBeLessThanOrEqual(5);
  });

  it("la memoria social limita el peso histórico a 20 votos", () => {
    const heavy = rateWith({ score: 4, weight: 500, votes: 500 }, 1, 4.8);
    const capped = rateWith({ score: 4, weight: 20, votes: 20 }, 1, 4.8);
    expect(heavy.score).toBe(capped.score);
    expect(heavy.votes).toBe(501);
  });
});

describe("reto diario", () => {
  it("todas las combinaciones dan un puntaje válido y 3 emojis", () => {
    DAILY_EFFECTS.forEach((_, scenario) => {
      for (let a = 0; a < 3; a++)
        for (let b = 0; b < 3; b++)
          for (let c = 0; c < 3; c++) {
            const r = dailyOutcome(scenario, [a, b, c]);
            expect(r.score).toBeGreaterThanOrEqual(0.1);
            expect(r.score).toBeLessThanOrEqual(5);
            expect([...r.grid].filter((ch) => /\p{Extended_Pictographic}/u.test(ch))).toHaveLength(3);
          }
    });
  });
});

describe("textos", () => {
  it("detecta palabras felices y negativas en los tres idiomas, sin tildes", () => {
    expect(analyzeText("¡Increíble día, gracias!").happy).toEqual(["increible", "gracias"]);
    expect(analyzeText("I hate this SYSTEM").negative).toEqual(["hate", "system"]);
    expect(analyzeText("Estou cansei").negative).toEqual(["cansei"]);
  });

  it("oculta insultos conservando el largo", () => {
    expect(moderate("eres un idiota")).toEqual({ text: "eres un ••••••", masked: true });
    expect(moderate("hola").masked).toBe(false);
  });
});

describe("récords", () => {
  it("speedrun y contrarreloj: menos es mejor; supervivencia: más es mejor", () => {
    expect(isBetter("speedrun", 1000, 2000)).toBe(true);
    expect(isBetter("climb", 3000, 2000)).toBe(false);
    expect(isBetter("survival", 3000, 2000)).toBe(true);
    expect(isBetter("speedrun", 1000, null)).toBe(true);
    expect(isBetter("speedrun", null, 1000)).toBe(false);
  });
});
