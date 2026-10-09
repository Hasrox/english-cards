import { cn } from "@/lib/cn";
import { TRANSITION } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import { m } from "motion/react";
import type { ReactNode } from "react";

/**
 * Shared screen-enter transition (PRD FR-5.1 · Phase 1) — the Motion
 * replacement for the `.screen-in` CSS keyframe: fade + 10px rise over
 * 320ms with the app's standard easing (visually identical).
 *
 * Mounted once at the route wrapper in `__root.tsx` `Screen()`, so every
 * route inherits it. Under `prefers-reduced-motion` the transition duration
 * collapses to 0 — screens appear instantly, parity with the CSS media
 * query in `src/styles.css`. The `screen-transition` class is a selector
 * test hook only; no CSS is attached to it.
 */
export function ScreenTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className="screen-transition"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : TRANSITION.standard}
    >
      {children}
    </m.div>
  );
}

export function Frame({
  children,
  className,
  dock = false,
}: {
  children: ReactNode;
  className?: string;
  dock?: boolean;
}) {
  return (
    <div className={cn("mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper text-ink", dock && "dock-pad", className)}>
      {children}
    </div>
  );
}

export function BootScreen() {
  return (
    <Frame>
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="font-display text-4xl tracking-tight">English Cards</p>
      </main>
    </Frame>
  );
}

export function ProblemScreen({ message }: { message: string }) {
  return (
    <Frame>
      <main className="flex flex-1 flex-col justify-center px-6">
        <h1 className="font-display text-4xl tracking-tight text-balance">Cards stayed shut</h1>
        <p className="mt-3 text-pretty text-muted">{message}</p>
      </main>
    </Frame>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-medium text-ink",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
