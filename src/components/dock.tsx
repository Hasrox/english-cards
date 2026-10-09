import { Link, useRouterState } from "@tanstack/react-router";
import { m } from "motion/react";
import { SPRING } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

const ITEMS = [
  { to: "/", label: "Today", icon: "/ui/today.png", exact: true },
  { to: "/island", label: "Island", icon: "/ui/island.png", exact: false },
  { to: "/play", label: "Play", icon: "/ui/play.png", exact: false },
  { to: "/words", label: "Words", icon: "/ui/words.png", exact: false },
  { to: "/days", label: "Days", icon: "/ui/days.jpg", exact: false },
] as const;

export function Dock() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const reduced = useReducedMotion();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-line bg-paper/95">
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = item.exact
            ? path === item.to
            : path === item.to || path.startsWith(`${item.to}/`);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-200 ${active ? "text-ink" : "text-muted"}`}
              >
                {active ? (
                  <m.span
                    aria-hidden="true"
                    data-dock-pill=""
                    layoutId="dock-active"
                    className="absolute inset-x-2 inset-y-1 rounded-2xl bg-card shadow-sm"
                    transition={reduced ? { duration: 0 } : SPRING.snappy}
                  />
                ) : null}
                <img
                  src={item.icon}
                  alt=""
                  className={`relative size-8 object-contain transition-opacity duration-200 ${active ? "" : "opacity-40"}`}
                />
                <span className="relative">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function showDock(path: string): boolean {
  if (path === "/review") return false;
  if (path === "/learn") return false;
  if (path.startsWith("/play/")) return false;
  return true;
}
