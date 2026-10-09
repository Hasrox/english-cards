import { useCallback, useEffect, useState } from "react";

/**
 * Fullscreen toggle (PRD FR-7 · Phase 4).
 *
 * Order of attack:
 * 1. Web Fullscreen API — works in desktop Chrome, PWAs, and most browsers.
 *    Requires a user gesture; rejections fall through.
 * 2. `window.AndroidUi` bridge — the custom WebView shell does not implement
 *    the Web Fullscreen API, so MainActivity exposes enter/exit that hide the
 *    system bars (Java ships with the Phase 5 APK).
 *
 * State syncs on `fullscreenchange` for the web path; the bridge path sets
 * state directly (it has no DOM event).
 */
type AndroidUiBridge = {
  enterFullscreen: () => void;
  exitFullscreen: () => void;
};

function getBridge(): AndroidUiBridge | undefined {
  return (window as unknown as { AndroidUi?: AndroidUiBridge }).AndroidUi;
}

export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        return;
      }
    } catch {
      // Unsupported (Android WebView) or rejected — try the native bridge.
    }
    const ui = getBridge();
    if (!ui) return;
    const next = !fullscreen;
    if (next) ui.enterFullscreen();
    else ui.exitFullscreen();
    setFullscreen(next);
  }, [fullscreen]);

  return { fullscreen, toggle };
}
