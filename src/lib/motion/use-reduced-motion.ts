/**
 * Single import point for reduced-motion (PRD FR-1.3 · Phase 0).
 *
 * Use this hook to gate non-essential motion: when it returns `true`, fall
 * back to instant state changes (color/opacity only), matching the existing
 * `@media (prefers-reduced-motion: reduce)` block in `src/styles.css`.
 * Returns `null` on the server / first render — treat as "animate" is unsafe,
 * prefer rendering the final state directly when null on the client.
 */
export { useReducedMotion } from "motion/react";
