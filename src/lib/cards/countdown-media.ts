/**
 * Countdown overlay art (REQ-001..REQ-005 in massage_to_user_UI_elements.txt).
 *
 * Playback chain per beat: alpha WebM -> animated WebP -> static still -> the
 * pre-existing text. `CountOverlay` in src/components/review-session.tsx walks
 * it; this module only owns the URLs and the switch that arms it.
 *
 * The five replies in user_ui_massages_replies/ are NOT transparent: they
 * declare alpha (VP8X flag, ALPH chunk per frame, ffprobe reports `argb`)
 * but the alpha plane is fully opaque in every pixel of every frame. The
 * checkerboard is painted into RGB as two exact tones, (221,219,221) and
 * (255,253,255), so the clips render over a grey checkerboard rather than
 * dropping out. That is expected for the device test — we want to see the
 * clips actually play before commissioning proper alpha renders.
 *
 * `ART_ENABLED` is true, so playback is armed. Re-run
 * `node scripts/make-countdown-media.mjs` once genuinely transparent art
 * lands; the fallback chain already degrades on its own if a file is bad.
 */

export type Beat = "ready" | "3" | "2" | "1" | "go";

export interface BeatArt {
  /** Alpha WebM (VP9, yuva420p) — primary playback. */
  webm: string;
  /** Animated WebP with alpha — fallback. */
  webp: string;
  /** Static final frame — reduced motion and still fallback. */
  still: string;
  /** Pre-existing text, the final fallback. */
  text: string;
}

const base = "/videos";

export const BEAT_ART: Record<Beat, BeatArt> = {
  ready: {
    webm: `${base}/get-ready.webm`,
    webp: `${base}/get-ready.webp`,
    still: `${base}/get-ready.png`,
    text: "Get ready",
  },
  "3": {
    webm: `${base}/count-3.webm`,
    webp: `${base}/count-3.webp`,
    still: `${base}/count-3.png`,
    text: "3",
  },
  "2": {
    webm: `${base}/count-2.webm`,
    webp: `${base}/count-2.webp`,
    still: `${base}/count-2.png`,
    text: "2",
  },
  "1": {
    webm: `${base}/count-1.webm`,
    webp: `${base}/count-1.webp`,
    still: `${base}/count-1.png`,
    text: "1",
  },
  go: {
    webm: `${base}/start.webm`,
    webp: `${base}/start.webp`,
    still: `${base}/start.png`,
    text: "START!",
  },
};

/**
 * Armed for the device test. These clips are opaque with a baked-in
 * checkerboard, so they render over a grey checkerboard rather than
 * dropping out — that is expected until real alpha renders are commissioned.
 */
export const ART_ENABLED = true;