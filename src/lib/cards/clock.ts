import { useEffect } from "react";
import { useVault } from "./store";

const SLICE_CAP = 2 * 60 * 60 * 1000;

// One timestamp while a quiz or a game is on screen. Saved once when you leave or the phone sleeps.
// Opening the app does not add time, and nothing keeps ticking in the background.
export function usePracticeClock(active: boolean): void {
  const addPracticeMs = useVault((state) => state.addPracticeMs);
  useEffect(() => {
    if (!active) return;
    let started = document.visibilityState === "visible" ? Date.now() : 0;
    const flush = () => {
      if (!started) return;
      const elapsed = Math.min(Date.now() - started, SLICE_CAP);
      started = 0;
      if (elapsed >= 1000) void addPracticeMs(elapsed);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else if (!started) started = Date.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [active, addPracticeMs]);
}
