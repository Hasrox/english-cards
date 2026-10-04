import { Link, useRouterState } from "@tanstack/react-router";

const ITEMS = [
  { to: "/", label: "Today", icon: "/ui/today.png", exact: true },
  { to: "/island", label: "Island", icon: "/ui/island.png", exact: false },
  { to: "/play", label: "Play", icon: "/ui/play.png", exact: false },
  { to: "/words", label: "Words", icon: "/ui/words.png", exact: false },
  { to: "/days", label: "Days", icon: "/ui/days.jpg", exact: false },
] as const;

export function Dock() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-line bg-paper/95">
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = item.exact ? path === item.to : path === item.to || path.startsWith(`${item.to}/`);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${active ? "text-ink" : "text-muted"}`}
              >
                <img src={item.icon} alt="" className={`size-8 object-contain ${active ? "" : "opacity-40"}`} />
                {item.label}
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
  if (path.startsWith("/play/")) return false;
  return true;
}
