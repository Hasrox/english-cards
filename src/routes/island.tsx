import { createFileRoute, Link } from "@tanstack/react-router";
import { Maximize2, Minimize2, Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { wordById } from "@/data/words";
import { BootScreen, Frame, ProblemScreen } from "@/components/chrome";
import {
  SLIP_ID,
  bandLabel,
  groupStats,
  islandGroups,
  wordBand,
  type IslandGroup,
} from "@/lib/cards/groups";
import { categoryArt } from "@/lib/cards/category-art";
import { GroupBar } from "@/components/group-bar";
import { studySnapshot } from "@/lib/cards/stats";
import { useVault } from "@/lib/cards/store";
import { useFullscreen } from "@/lib/fullscreen";
import { SPRING } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import { m } from "motion/react";

export const Route = createFileRoute("/island")({ component: IslandPage });

function IslandPage() {
  const ready = useVault((state) => state.ready);
  const listsReady = useVault((state) => state.listsReady);
  const error = useVault((state) => state.error);
  if (error) return <ProblemScreen message={error} />;
  if (!ready || !listsReady) return <BootScreen />;
  return <Island />;
}

type Placed = IslandGroup & { x: number; y: number; size: number };

function Island() {
  const progress = useVault((state) => state.progress);
  const library = useVault((state) => state.library);
  const own = useVault((state) => state.own);
  const groups = useMemo(() => islandGroups(progress), [progress]);
  const placed = useMemo(() => layout(groups), [groups]);
  const stats = useMemo(() => {
    const ids = new Set(library.map((word) => word.id));
    return groupStats(library.concat(own.filter((word) => !ids.has(word.id))), progress);
  }, [library, own, progress]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const group = placed.find((item) => item.id === selected) ?? null;
  const reduced = useReducedMotion();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{
    dist: number;
    scale: number;
    midX: number;
    midY: number;
    vx: number;
    vy: number;
  } | null>(null);
  const pinchEndedAt = useRef(0);

  if (groups.length === 0) {
    return (
      <Frame dock>
        <header className="safe-top px-6 pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-5xl tracking-tight">Island</h1>
              <p className="mt-3 max-w-sm text-pretty text-muted">
                Words gather here by what they mean, once they are in your deck.
              </p>
            </div>
            <FullscreenButton />
          </div>
        </header>
        <m.main
          className="px-6"
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { ...SPRING.soft, delay: 0.05 }}
        >
          <img src="/ui/empty-island.png" alt="" className="mt-2 h-40 w-full object-contain" />
          <Link
            to="/words"
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 font-medium text-paper"
          >
            Add words
          </Link>
        </m.main>
      </Frame>
    );
  }

  return (
    <Frame dock>
      <header className="safe-top px-6 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-5xl tracking-tight">Island</h1>
            <p className="mt-3 max-w-sm text-pretty text-muted">
              Groups are by meaning. One picture for each group. Words you keep missing sit on
              Slipping, and you can revise them today.
            </p>
          </div>
          <FullscreenButton />
        </div>
      </header>
      {group ? (
        <section className="px-5">
          <GroupSheet
            group={group}
            learned={stats.get(group.id)?.learned ?? 0}
            total={stats.get(group.id)?.total ?? group.words.length}
            onBack={() => setSelected(null)}
          />
        </section>
      ) : (
        <>
          <div
            ref={boxRef}
            className="desk-card relative mx-5 h-96 touch-none overflow-hidden rounded-3xl border border-line bg-card"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, var(--color-line) 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
            onPointerDown={(event) => {
              pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              if (pointers.current.size === 2) {
                // Two fingers down anywhere on the map → pinch takes over.
                drag.current = null;
                const rect = boxRef.current?.getBoundingClientRect();
                const pts = [...pointers.current.values()];
                if (rect && pts.length === 2) {
                  pinch.current = {
                    dist: Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)),
                    scale: view.scale,
                    midX: (pts[0].x + pts[1].x) / 2 - (rect.left + rect.width / 2),
                    midY: (pts[0].y + pts[1].y) / 2 - (rect.top + rect.height / 2),
                    vx: view.x,
                    vy: view.y,
                  };
                }
                return;
              }
              if (pointers.current.size > 2) return;
              if (event.target !== event.currentTarget) return;
              drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!pointers.current.has(event.pointerId)) return;
              pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              const p = pinch.current;
              if (p && pointers.current.size >= 2) {
                const rect = boxRef.current?.getBoundingClientRect();
                const pts = [...pointers.current.values()];
                if (!rect || pts.length < 2) return;
                const dist = Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
                const midX = (pts[0].x + pts[1].x) / 2 - (rect.left + rect.width / 2);
                const midY = (pts[0].y + pts[1].y) / 2 - (rect.top + rect.height / 2);
                const nextScale = Math.min(2.2, Math.max(0.6, p.scale * (dist / p.dist)));
                // Keep the content point under the initial midpoint pinned to
                // the live midpoint: v' = mid' - ((mid - v₀) / s₀) · s'.
                const ux = (p.midX - p.vx) / p.scale;
                const uy = (p.midY - p.vy) / p.scale;
                setView({ x: midX - ux * nextScale, y: midY - uy * nextScale, scale: nextScale });
                return;
              }
              if (!drag.current) return;
              setView((current) => ({
                ...current,
                x: drag.current ? drag.current.vx + event.clientX - drag.current.x : current.x,
                y: drag.current ? drag.current.vy + event.clientY - drag.current.y : current.y,
              }));
            }}
            onPointerUp={(event) => {
              pointers.current.delete(event.pointerId);
              if (pointers.current.size < 2 && pinch.current) {
                pinch.current = null;
                pinchEndedAt.current = Date.now();
              }
              if (pointers.current.size === 0) drag.current = null;
            }}
            onPointerCancel={(event) => {
              pointers.current.delete(event.pointerId);
              if (pointers.current.size < 2 && pinch.current) {
                pinch.current = null;
                pinchEndedAt.current = Date.now();
              }
              if (pointers.current.size === 0) drag.current = null;
            }}
          >
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
              <ZoomButton
                label="Zoom in"
                onClick={() =>
                  setView((current) => ({ ...current, scale: Math.min(2.2, current.scale + 0.2) }))
                }
              >
                <Plus aria-hidden="true" className="size-5" />
              </ZoomButton>
              <ZoomButton
                label="Zoom out"
                onClick={() =>
                  setView((current) => ({ ...current, scale: Math.max(0.6, current.scale - 0.2) }))
                }
              >
                <Minus aria-hidden="true" className="size-5" />
              </ZoomButton>
              <ZoomButton label="Recenter" onClick={() => setView({ x: 0, y: 0, scale: 1 })}>
                <RotateCcw aria-hidden="true" className="size-5" />
              </ZoomButton>
            </div>
            <div
              className="absolute top-1/2 left-1/2"
              data-map-content=""
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            >
              {placed.map((item, index) => {
                const hot = item.due + item.slipping > 0;
                return (
                  <m.span
                    key={item.id}
                    className="absolute"
                    style={{
                      left: `calc(50% + ${item.x}px)`,
                      top: `calc(50% + ${item.y}px)`,
                      width: item.size,
                      height: item.size,
                      marginLeft: -item.size / 2,
                      marginTop: -item.size / 2,
                    }}
                    initial={reduced ? false : { opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { ...SPRING.soft, delay: Math.min(index, 8) * 0.05 }
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (Date.now() - pinchEndedAt.current < 350) return;
                        setSelected(item.id);
                      }}
                      aria-label={item.label}
                      className="flex size-full items-center justify-center rounded-full"
                    >
                      <img
                        src={categoryArt(item.id)}
                        alt=""
                        className={`size-full rounded-full object-cover shadow-lg ${
                          hot ? "ring-4 ring-accent" : "ring-2 ring-white"
                        }`}
                      />
                      <span className="pointer-events-none absolute top-full left-1/2 mt-1 w-28 -translate-x-1/2 text-center font-display text-sm leading-tight text-balance">
                        <span className="rounded-full bg-paper/90 px-2 py-0.5 shadow-sm">
                          {item.label}
                        </span>
                      </span>
                      <span
                        className={`pointer-events-none absolute top-full left-1/2 mt-7 w-28 -translate-x-1/2 text-center text-xs ${
                          hot ? "font-semibold text-accent" : "text-muted"
                        }`}
                      >
                        {item.due > 0
                          ? `${item.due} due`
                          : item.fresh > 0
                            ? `${item.fresh} new`
                            : item.words.length === 1
                              ? "1 word"
                              : `${item.words.length} words`}
                      </span>
                    </button>
                  </m.span>
                );
              })}
            </div>
          </div>
          <section className="px-5 pt-4">
            <p className="text-sm text-muted">
              Drag the map. Pinch (or use + / −) to zoom. Tap a group to learn new words or revise.
            </p>
            <ul className="mt-3">
              {placed.map((item, index) => (
                <m.li
                  key={item.id}
                  className="border-t border-line"
                  initial={reduced || index >= 10 ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: 0.3, delay: index < 10 ? index * 0.03 : 0 }
                  }
                >
                  <button
                    type="button"
                    onClick={() => setSelected(item.id)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <img
                        src={categoryArt(item.id)}
                        alt=""
                        className="size-10 shrink-0 rounded-full object-cover"
                      />
                      <span className="font-medium">{item.label}</span>
                    </span>
                    <span className="text-sm text-muted">
                      {item.due > 0
                        ? `${item.due} due`
                        : item.fresh > 0
                          ? `${item.fresh} new`
                          : `${item.words.length}`}
                    </span>
                  </button>
                  {item.id === SLIP_ID ? null : (
                    <div className="pb-3">
                      <GroupBar
                        learned={stats.get(item.id)?.learned ?? 0}
                        total={stats.get(item.id)?.total ?? item.words.length}
                      />
                    </div>
                  )}
                </m.li>
              ))}
            </ul>
          </section>
        </>
      )}
    </Frame>
  );
}

function GroupSheet({
  group,
  learned,
  total,
  onBack,
}: {
  group: IslandGroup;
  learned: number;
  total: number;
  onBack: () => void;
}) {
  const progress = useVault((state) => state.progress);
  const settings = useVault((state) => state.settings);
  const snap = studySnapshot(progress, settings);
  const now = Date.now();
  const preview = group.words.slice(0, 6);
  const reduced = useReducedMotion();
  // Slipping has no New cards; Learn only when this group has fresh words and
  // the daily new cap still has room.
  const canLearn = group.id !== SLIP_ID && group.fresh > 0 && snap.newLeft > 0;
  const reviseClass = canLearn
    ? "inline-flex min-h-12 items-center justify-center rounded-full border border-line px-3 text-sm font-medium"
    : "inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-3 text-sm font-medium text-paper";

  return (
    <m.div
      className="rounded-3xl border border-line bg-card px-4 py-4 shadow-sm"
      initial={reduced ? false : { opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduced ? { duration: 0 } : SPRING.soft}
    >
      <button type="button" onClick={onBack} className="min-h-11 text-sm text-muted">
        All groups
      </button>
      <div className="mt-2 flex items-center gap-3">
        <img
          src={categoryArt(group.id)}
          alt=""
          className="size-16 shrink-0 rounded-full object-cover"
        />
        <h2 className="font-display text-3xl tracking-tight">{group.label}</h2>
      </div>
      <p className="mt-1 text-sm text-pretty text-muted">{group.hint}</p>
      {group.id === SLIP_ID ? null : <GroupBar learned={learned} total={total} />}
      <p className="mt-3 text-sm text-muted">
        {group.due} due · {group.learning} learning · {group.fresh} new · {group.known} known
      </p>
      <ul className="mt-3 flex flex-col">
        {preview.map((id, index) => {
          const word = wordById(id);
          const row = progress[id];
          if (!word || !row) return null;
          return (
            <m.li
              key={id}
              className="flex items-baseline justify-between gap-3 border-t border-line py-2 first:border-t-0"
              initial={reduced ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.25, delay: 0.1 + index * 0.04 }}
            >
              <span className="font-medium">{word.lemma}</span>
              <span className="text-sm text-muted">{bandLabel(wordBand(row, now))}</span>
            </m.li>
          );
        })}
      </ul>
      {group.words.length > preview.length ? (
        <p className="text-sm text-muted">and {group.words.length - preview.length} more</p>
      ) : null}

      {canLearn ? (
        <Link
          to="/learn"
          search={{ topic: group.id }}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-3 text-sm font-medium text-paper"
        >
          Learn now
        </Link>
      ) : null}

      <div className={`grid grid-cols-2 gap-2 ${canLearn ? "mt-2" : "mt-4"}`}>
        <Link
          to="/review"
          search={{ mode: "practice", topic: group.id }}
          className={reviseClass}
        >
          Revise now
        </Link>
        <Link
          to="/play/letters"
          search={{ topic: group.id }}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-3 text-sm font-medium"
        >
          Missing letter
        </Link>
        <Link
          to="/play/match"
          search={{ topic: group.id }}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-3 text-sm font-medium"
        >
          Match
        </Link>
        <Link
          to="/play/connect"
          search={{ topic: group.id }}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-3 text-sm font-medium"
        >
          Connect
        </Link>
      </div>
    </m.div>
  );
}

function FullscreenButton() {
  const { fullscreen, toggle } = useFullscreen();
  return (
    <button
      type="button"
      aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}
      aria-pressed={fullscreen}
      onClick={() => void toggle()}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-paper/80 text-ink shadow-sm backdrop-blur-sm"
    >
      {fullscreen ? (
        <Minimize2 aria-hidden="true" className="size-5" />
      ) : (
        <Maximize2 aria-hidden="true" className="size-5" />
      )}
    </button>
  );
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-paper/80 text-ink shadow-sm backdrop-blur-sm"
    >
      {children}
    </button>
  );
}

function layout(groups: IslandGroup[]): Placed[] {
  return groups.map((group, index) => {
    const size = 104 + Math.min(group.words.length, 16) * 2;
    const angle = index * 2.399963;
    const ring = index === 0 ? 0 : 136 + index * 48;
    return {
      ...group,
      size,
      x: Math.cos(angle) * ring,
      y: Math.sin(angle) * ring,
    };
  });
}
