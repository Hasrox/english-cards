import { animate, m } from "motion/react";
import { useEffect, useState } from "react";
import { haptics } from "@/lib/motion/haptics";
import { EASE } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

/** Arc + count-up run synced at ~900ms (PRD FR-3.1/3.2). */
const SCORE_SECONDS = 0.9;

export type Tally = { correct: number; attempts: number };

export const EMPTY_TALLY: Tally = { correct: 0, attempts: 0 };

export function addTap(tally: Tally, right: boolean): Tally {
  return { correct: tally.correct + (right ? 1 : 0), attempts: tally.attempts + 1 };
}

export function ScoreReport({ tally }: { tally: Tally }) {
  const pct = tally.attempts === 0 ? 0 : Math.round((tally.correct / tally.attempts) * 100);
  const perfect = tally.attempts > 0 && tally.correct === tally.attempts;
  const reduced = useReducedMotion();
  const [counted, setCounted] = useState(0);

  useEffect(() => {
    if (perfect) haptics.celebrate();
    if (reduced) return;
    const controls = animate(0, pct, {
      duration: SCORE_SECONDS,
      ease: EASE.standard,
      onUpdate: (value) => setCounted(Math.round(value)),
    });
    return () => controls.stop();
  }, [perfect, reduced, pct]);

  // Under reduced motion the number is final from the very first render.
  const shown = reduced ? pct : counted;

  return (
    <section className={`mt-6 ${perfect ? "celebrate" : ""}`}>
      <div className="relative mx-auto h-36 w-64">
        <svg
          viewBox="0 0 200 120"
          className="h-full w-full"
          role="img"
          aria-label={`Accuracy ${pct} percent`}
        >
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#e4ddd2"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <m.path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#1b6b58"
            strokeWidth="14"
            strokeLinecap="round"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: pct / 100 }}
            transition={
              reduced ? { duration: 0 } : { duration: SCORE_SECONDS, ease: EASE.standard }
            }
          />
        </svg>
        <p className="absolute inset-x-0 bottom-2 text-center font-display text-4xl tracking-tight">
          <span className="tabular-nums">{shown}</span>%
        </p>
        {perfect ? <SparkBurst /> : null}
      </div>
      <p className="mt-2 text-center font-display text-3xl tracking-tight">{tally.correct} right</p>
      <p className="mt-1 text-center text-sm text-muted">
        {tally.correct} of {tally.attempts} {tally.attempts === 1 ? "try" : "tries"}
      </p>
      {perfect ? (
        <p className="mt-2 text-center text-sm font-medium text-accent">Full marks.</p>
      ) : null}
    </section>
  );
}

export function Sparkles() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {BURST.map((spot, index) => (
        <BurstDot
          key={index}
          index={index}
          x={spot.x}
          y={spot.y}
          top="40%"
          size={7}
          color="#e2b340"
          step={0.03}
        />
      ))}
    </span>
  );
}

function SparkBurst() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {BURST.map((spot, index) => (
        <BurstDot
          key={index}
          index={index}
          x={spot.x}
          y={spot.y}
          top="58%"
          size={10}
          color="#f2d56b"
          step={0.04}
        />
      ))}
    </span>
  );
}

/**
 * One flying dot of a burst (PRD FR-3.3) — replaces the `.spark` CSS
 * keyframes with a Motion stagger. Decorative: not rendered at all under
 * prefers-reduced-motion. `[data-spark]` is a test hook, no CSS attached.
 */
function BurstDot({
  index,
  x,
  y,
  top,
  size,
  color,
  step,
}: {
  index: number;
  x: number;
  y: number;
  top: string;
  size: number;
  color: string;
  step: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <m.span
      data-spark=""
      style={{
        position: "absolute",
        left: "50%",
        top,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: 999,
        background: color,
      }}
      initial={{ opacity: 0, scale: 0.4, x: 0, y: 0 }}
      animate={{ opacity: [1, 1, 0], scale: 1, x, y }}
      transition={{ duration: 0.7, delay: index * step, ease: "easeOut" }}
    />
  );
}

/** Burst coordinates in px, relative to the dot's center point. */
const BURST = [
  { x: -36, y: -28 },
  { x: 34, y: -30 },
  { x: -18, y: -42 },
  { x: 16, y: -40 },
  { x: -44, y: -6 },
  { x: 42, y: -8 },
  { x: 0, y: -48 },
  { x: 24, y: -16 },
];
