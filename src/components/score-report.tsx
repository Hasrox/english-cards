import { useEffect, useState } from "react";

const ARC = Math.PI * 80;

export type Tally = { correct: number; attempts: number };

export const EMPTY_TALLY: Tally = { correct: 0, attempts: 0 };

export function addTap(tally: Tally, right: boolean): Tally {
  return { correct: tally.correct + (right ? 1 : 0), attempts: tally.attempts + 1 };
}

export function ScoreReport({ tally }: { tally: Tally }) {
  const pct = tally.attempts === 0 ? 0 : Math.round((tally.correct / tally.attempts) * 100);
  const perfect = tally.attempts > 0 && tally.correct === tally.attempts;
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setFilled(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const offset = filled ? ARC * (1 - pct / 100) : ARC;
  return (
    <section className={`mt-6 ${perfect ? "celebrate" : ""}`}>
      <div className="relative mx-auto h-36 w-64">
        <svg viewBox="0 0 200 120" className="h-full w-full" role="img" aria-label={`Accuracy ${pct} percent`}>
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e4ddd2" strokeWidth="14" strokeLinecap="round" />
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#1b6b58"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={ARC}
            strokeDashoffset={offset}
            className="arch-fill"
          />
        </svg>
        <p className="absolute inset-x-0 bottom-2 text-center font-display text-4xl tracking-tight">{pct}%</p>
        {perfect ? <SparkBurst /> : null}
      </div>
      <p className="mt-2 text-center font-display text-3xl tracking-tight">{tally.correct} right</p>
      <p className="mt-1 text-center text-sm text-muted">
        {tally.correct} of {tally.attempts} {tally.attempts === 1 ? "try" : "tries"}
      </p>
      {perfect ? <p className="mt-2 text-center text-sm font-medium text-accent">Full marks.</p> : null}
    </section>
  );
}

export function Sparkles() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {BURST.map((spot, index) => (
        <span
          key={index}
          className="spark"
          style={{ ["--x" as string]: spot.x, ["--y" as string]: spot.y, animationDelay: `${index * 30}ms` }}
        />
      ))}
    </span>
  );
}

function SparkBurst() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {BURST.map((spot, index) => (
        <span
          key={index}
          className="spark spark-big"
          style={{ left: "50%", top: "58%", ["--x" as string]: spot.x, ["--y" as string]: spot.y, animationDelay: `${index * 40}ms` }}
        />
      ))}
    </span>
  );
}

const BURST = [
  { x: "-36px", y: "-28px" },
  { x: "34px", y: "-30px" },
  { x: "-18px", y: "-42px" },
  { x: "16px", y: "-40px" },
  { x: "-44px", y: "-6px" },
  { x: "42px", y: "-8px" },
  { x: "0px", y: "-48px" },
  { x: "24px", y: "-16px" },
];
