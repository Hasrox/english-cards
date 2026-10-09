import { m } from "motion/react";
import { TRANSITION } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

export function GroupBar({ learned, total }: { learned: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((learned / total) * 100)) : 0;
  const reduced = useReducedMotion();
  return (
    <div className="mt-3">
      <div
        className="h-2 overflow-hidden rounded-full bg-line"
        role="meter"
        aria-valuemin={0}
        aria-valuenow={learned}
        aria-valuemax={total}
        aria-label={`${learned} of ${total} learned`}
      >
        <m.div
          className="h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={reduced ? { duration: 0 } : TRANSITION.standard}
        />
      </div>
      <p className="mt-1 text-xs text-muted">
        {learned} of {total} learned
      </p>
    </div>
  );
}
