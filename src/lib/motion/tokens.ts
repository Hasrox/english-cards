/**
 * Motion tokens — the single source of truth for animation timing (PRD FR-1.2).
 *
 * Durations are in SECONDS (Motion's convention); the CSS keyframes these
 * replace in `src/styles.css` were written in ms — e.g. `.screen-in` 320ms
 * === `DURATION.base`.
 */
import type { Transition } from "motion/react";

/** Duration presets, in seconds. */
export const DURATION = {
  /** 120ms — instant feedback: press states, color flips. */
  instant: 0.12,
  /** 200ms — fast: exits, small positional moves. */
  fast: 0.2,
  /** 320ms — base: matches the existing `.screen-in` keyframe. */
  base: 0.32,
  /** 480ms — slow: deliberate reveals, celebration beats. */
  slow: 0.48,
} as const;

/**
 * Shared cubic-bezier easings as `[x1, y1, x2, y2]` tuples.
 * `standard` is the app's signature curve — identical to the
 * `cubic-bezier(0.2, 0.7, 0.2, 1)` used throughout `src/styles.css`.
 */
export const EASE = {
  standard: [0.2, 0.7, 0.2, 1] as [number, number, number, number],
  /** Elements arriving on screen (fast start, settles — decelerate in). */
  enter: [0, 0, 0.2, 1] as [number, number, number, number],
  /** Elements leaving the screen (starts slow, ramps up — accelerate out). */
  exit: [0.4, 0, 1, 1] as [number, number, number, number],
} as const;

/**
 * Spring presets (PRD FR-1.2). Pick by feel, never tune springs inline:
 *
 * - `snappy` — tight, immediate: buttons, dock indicator.
 * - `soft`    — settles smoothly without overshoot: card enter (Phase 2).
 * - `bouncy`  — overshoots once: countdown beats (Phase 2).
 */
export const SPRING: Record<"snappy" | "soft" | "bouncy", Transition> = {
  snappy: { type: "spring", stiffness: 380, damping: 30, mass: 1 },
  soft: { type: "spring", stiffness: 170, damping: 26, mass: 1 },
  bouncy: { type: "spring", stiffness: 300, damping: 14, mass: 1 },
};

/** Ready-made tween transitions for simple fades/moves. */
export const TRANSITION: Record<"fast" | "standard" | "slow", Transition> = {
  fast: { duration: DURATION.fast, ease: EASE.standard },
  standard: { duration: DURATION.base, ease: EASE.standard },
  slow: { duration: DURATION.slow, ease: EASE.standard },
};
