import { useCallback, useState } from "react";
import { METRICS_KEY } from "../game/config.js";

/* ---------- Métricas locales (embudo de compartir) ---------- */
export function useMetrics() {
  const [metrics, setMetrics] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(METRICS_KEY)) ?? {};
    } catch {
      return {};
    }
  });
  const track = useCallback((k) => {
    setMetrics((prev) => {
      const next = { ...prev, [k]: (prev[k] ?? 0) + 1 };
      try {
        localStorage.setItem(METRICS_KEY, JSON.stringify(next));
      } catch {
        /* sin almacenamiento */
      }
      return next;
    });
  }, []);
  return [metrics, track];
}
