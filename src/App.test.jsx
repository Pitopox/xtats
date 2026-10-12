import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App.jsx";
import { I18N } from "./i18n.js";

const t = I18N.es;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("xtats-lang", "es");
});
afterEach(cleanup);

describe("App (modo demo)", () => {
  it("pasa el inicio y muestra la partida con el puntaje inicial", async () => {
    render(<App />);
    fireEvent.change(document.getElementById("xt-name"), { target: { value: "Ana" } });
    fireEvent.change(document.getElementById("xt-birth"), { target: { value: "1995" } });
    fireEvent.click(document.getElementById("xt-satire"));
    await act(async () => fireEvent.click(screen.getByText(t.onboarding.start)));
    expect(screen.getAllByText("4.10").length).toBeGreaterThan(0);
    expect(screen.getByText(t.howto.title)).toBeTruthy();
  });

  it("bloquea a menores de 13 años", async () => {
    render(<App />);
    fireEvent.change(document.getElementById("xt-name"), { target: { value: "Leo" } });
    fireEvent.change(document.getElementById("xt-birth"), { target: { value: String(new Date().getFullYear() - 10) } });
    fireEvent.click(document.getElementById("xt-satire"));
    await act(async () => fireEvent.click(screen.getByText(t.onboarding.start)));
    expect(screen.getByText(t.onboarding.underageTitle)).toBeTruthy();
  });

  it("dibuja cada pestaña en los tres estilos sin errores", async () => {
    for (const skin of ["white", "pink", "black"]) {
      localStorage.setItem("xtats-skin", skin);
      const { unmount } = render(<App />);
      if (screen.queryByText(t.onboarding.start)) {
        fireEvent.change(document.getElementById("xt-name"), { target: { value: "Ana" } });
        fireEvent.change(document.getElementById("xt-birth"), { target: { value: "1995" } });
        fireEvent.click(document.getElementById("xt-satire"));
        await act(async () => fireEvent.click(screen.getByText(t.onboarding.start)));
        fireEvent.click(screen.getByText(t.howto.close));
      }
      for (const tab of ["today", "camera", "challenges", "friends", "play"]) {
        await act(async () => fireEvent.click(screen.getByText(t.tabs[tab])));
      }
      expect(document.querySelector(`[data-skin="${skin}"]`)).toBeTruthy();
      unmount();
    }
  });
});
