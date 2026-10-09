/**
 * Beat offsets for the review countdown gate (PRD FR-2.3), in milliseconds
 * after `3-sec-countdown.mp3` starts playing.
 *
 * The audio is NOT a 3-second file with beeps at 0/1000/2000: it is 5.77 s
 * with a deliberate lead-in. Measured with `ffmpeg` silencedetect + an
 * RMS envelope, the beeps land at:
 *
 * | beep            | 1.097 s |
 * | beep            | 2.116 s |
 * | beep            | 3.135 s |
 * | START flourish  | 4.153 s |
 *
 * ...i.e. 1019 ms apart, after 1097 ms of silence. Scheduling the visuals at
 * 0/1000/2000 therefore put every number ~1.1 s ahead of its own beep — the
 * first peep landed while the screen already read "2".
 *
 * These offsets are pinned to the audio's measured positions. If the mp3 is
 * ever re-exported, re-measure and update here — countdown-timing.test.ts
 * fails otherwise, which is the point: a silent off-beat regression is
 * exactly the bug this file exists to prevent.
 *
 * `GO_MS` is intentionally NOT the audio's flourish position (4153). The
 * question starting before the flourish finishes is the lesser evil, so
 * `go` and `setOpen` stay at 4000 and the flourish overlaps them. See
 * `START_OVERLAP_MS`.
 */

/** "3" appears on the first beep. */
export const THREE_MS = 1097;
/** "2" on the second beep. */
export const TWO_MS = 2116;
/** "1" on the third beep. */
export const ONE_MS = 3135;
/**
 * "GO" plus `setOpen(true)` — the moment the child's question appears.
 * Deliberately earlier than the audio's START flourish (4153 ms).
 */
export const GO_MS = 4000;
/** How far the START flourish runs past `GO_MS`. */
export const START_OVERLAP_MS = 153;
/** Overlay clears `GO_MS` + this long after the final beat. */
export const GO_HOLD_MS = 700;

/** Every beat in schedule order, for tests and assertions. */
export const BEAT_OFFSETS = {
  "3": THREE_MS,
  "2": TWO_MS,
  "1": ONE_MS,
  go: GO_MS,
} as const;

/** Offset at which the gate hides the overlay again. */
export const OVERLAY_CLEAR_MS = GO_MS + GO_HOLD_MS;
