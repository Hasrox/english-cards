/**
 * Haptic feedback via the Vibration API (PRD FR-4.2 · Phase 1).
 *
 * Every call is safe: where the API is missing (desktop browsers, SSR,
 * older WebViews) or throws (permission blocked), the call is a silent
 * no-op returning `false` — never throws (FR-4.2).
 *
 * The Vibration API surface is injectable so unit tests can assert the
 * exact patterns without a device: `buzz("wrong", fake)`.
 */

/** Haptic patterns — PRD FR-4.2 (milliseconds). */
export const HAPTIC_PATTERNS = {
  /** Light tick for generic taps. */
  tap: 10,
  /** Single pulse for a correct answer. */
  correct: 15,
  /** Erratic double-buzz for a wrong answer. */
  wrong: [0, 40, 40, 40],
  /** Rising rhythm for a perfect-score celebration. */
  celebrate: [0, 30, 60, 30, 120],
} as const;

export type HapticName = keyof typeof HAPTIC_PATTERNS;

/** The Vibration API shape, injectable for tests. */
export type VibrateFn = (pattern: number | number[]) => unknown;

function defaultVibrate(): VibrateFn | undefined {
  if (typeof navigator === "undefined") return undefined;
  // Desktop browsers may expose the symbol without physical effect; the
  // call itself is wrapped in try/catch either way.
  const vibrate = navigator.vibrate?.bind(navigator);
  return typeof vibrate === "function" ? vibrate : undefined;
}

/**
 * Fire one named pattern. Returns whether the platform accepted the call;
 * `false` when the Vibration API is missing or throws (no-op fallback).
 */
export function buzz(name: HapticName, vibrate?: VibrateFn): boolean {
  const fire = vibrate ?? defaultVibrate();
  if (!fire) return false;
  const raw = HAPTIC_PATTERNS[name];
  const pattern: number | number[] = typeof raw === "number" ? raw : [...raw];
  try {
    fire(pattern);
    return true;
  } catch {
    return false;
  }
}

/** App-facing haptics (PRD FR-4.2): `tap` / `correct` / `wrong` / `celebrate`. */
export const haptics = {
  tap: () => buzz("tap"),
  correct: () => buzz("correct"),
  wrong: () => buzz("wrong"),
  celebrate: () => buzz("celebrate"),
} as const;
