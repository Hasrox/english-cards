import { LazyMotion, MotionConfig, domMax } from "motion/react";
import type { ReactNode } from "react";

/**
 * App-wide Motion runtime (PRD FR-1.1 · Phase 0, upgraded Phase 4), mounted
 * once in `src/routes/__root.tsx`.
 *
 * - `domMax` = animations + hover/tap/inView gestures + drag + layout
 *   projection. Phase 4 needs `layout` for the dock's `layoutId` indicator
 *   (the bundle is re-measured on landing — delta in the Phase 4 commit
 *   body). Was `domAnimation` in Phases 0–3.
 * - `MotionConfig reducedMotion="user"` globally disables transform/layout
 *   animations under prefers-reduced-motion (opacity/color still allowed);
 *   component-level `reduced ? { duration: 0 }` gates remain as belt and
 *   braces for non-transform properties (width, pathLength).
 * - `strict` forbids the heavy `motion.*` components: animated markup MUST
 *   use the `m.*` components (e.g. `<m.div>`), or Motion throws in dev.
 *   `AnimatePresence` and hooks are unaffected.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
