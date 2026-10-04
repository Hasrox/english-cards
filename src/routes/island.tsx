import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { wordById } from "@/data/words";
import { BootScreen, Frame, ProblemScreen } from "@/components/chrome";
import { SLIP_ID, bandLabel, groupStats, islandGroups, wordBand, type IslandGroup } from "@/lib/cards/groups";
import { categoryArt } from "@/lib/cards/category-art";
import { GroupBar } from "@/components/group-bar";
import { useVault } from "@/lib/cards/store";

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

  if (groups.length === 0) {
    return (
      <Frame dock>
        <header className="safe-top px-6 pb-2">
          <h1 className="font-display text-5xl tracking-tight">Island</h1>
          <p className="mt-3 max-w-sm text-pretty text-muted">Words gather here by what they mean, once they are in your deck.</p>
        </header>
        <main className="px-6">
          <img src="/ui/empty-island.png" alt="" className="mt-2 h-40 w-full object-contain" />
          <Link to="/words" className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 font-medium text-paper">
            Add words
          </Link>
        </main>
      </Frame>
    );
  }

  return (
    <Frame dock>
      <header className="safe-top px-6 pb-3">
        <h1 className="font-display text-5xl tracking-tight">Island</h1>
        <p className="mt-3 max-w-sm text-pretty text-muted">
          Groups are by meaning. One picture for each group. Words you keep missing sit on Slipping, and you can revise them today.
        </p>
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
            className="relative mx-5 h-96 overflow-hidden rounded-3xl border border-line bg-card touch-none"
            onPointerDown={(event) => {
              if (event.target !== event.currentTarget) return;
              drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              setView((current) => ({
                ...current,
                x: drag.current ? drag.current.vx + event.clientX - drag.current.x : current.x,
                y: drag.current ? drag.current.vy + event.clientY - drag.current.y : current.y,
              }));
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
              <ZoomButton label="Zoom in" onClick={() => setView((current) => ({ ...current, scale: Math.min(2.2, current.scale + 0.2) }))}>
                <Plus aria-hidden="true" className="size-5" />
              </ZoomButton>
              <ZoomButton label="Zoom out" onClick={() => setView((current) => ({ ...current, scale: Math.max(0.6, current.scale - 0.2) }))}>
                <Minus aria-hidden="true" className="size-5" />
              </ZoomButton>
              <ZoomButton label="Recenter" onClick={() => setView({ x: 0, y: 0, scale: 1 })}>
                <RotateCcw aria-hidden="true" className="size-5" />
              </ZoomButton>
            </div>
            <div
              className="absolute top-1/2 left-1/2"
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            >
              {placed.map((item) => {
                const hot = item.due + item.slipping > 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item.id)}
                    aria-label={item.label}
                    className="absolute rounded-full"
                    style={{
                      width: item.size,
                      height: item.size,
                      marginLeft: -item.size / 2,
                      marginTop: -item.size / 2,
                      transform: `translate(${item.x}px, ${item.y}px)`,
                    }}
                  >
                    <img
                      src={categoryArt(item.id)}
                      alt=""
                      className={`size-full rounded-full object-cover ${hot ? "ring-4 ring-accent" : "ring-2 ring-white"}`}
                    />
                    <span className="absolute top-full left-1/2 mt-1 w-28 -translate-x-1/2 text-center font-display text-sm leading-tight text-balance">
                      {item.label}
                    </span>
                    <span className="absolute top-full left-1/2 mt-7 w-28 -translate-x-1/2 text-center text-xs text-muted">
                      {item.due > 0 ? `${item.due} due` : item.words.length === 1 ? "1 word" : `${item.words.length} words`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <section className="px-5 pt-4">
            <p className="text-sm text-muted">Drag the map. Tap a group to revise it now.</p>
            <ul className="mt-3">
              {placed.map((item) => (
                <li key={item.id} className="border-t border-line">
                  <button
                    type="button"
                    onClick={() => setSelected(item.id)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <img src={categoryArt(item.id)} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                      <span className="font-medium">{item.label}</span>
                    </span>
                    <span className="text-sm text-muted">{item.due > 0 ? `${item.due} due` : `${item.words.length}`}</span>
                  </button>
                  {item.id === SLIP_ID ? null : (
                    <div className="pb-3">
                      <GroupBar learned={stats.get(item.id)?.learned ?? 0} total={stats.get(item.id)?.total ?? item.words.length} />
                    </div>
                  )}
                </li>
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
  const now = Date.now();
  const preview = group.words.slice(0, 6);
  return (
    <div className="rounded-3xl border border-line bg-card px-4 py-4">
      <button type="button" onClick={onBack} className="min-h-11 text-sm text-muted">
        All groups
      </button>
      <div className="mt-2 flex items-center gap-3">
        <img src={categoryArt(group.id)} alt="" className="size-16 shrink-0 rounded-full object-cover" />
        <h2 className="font-display text-3xl tracking-tight">{group.label}</h2>
      </div>
      <p className="mt-1 text-sm text-pretty text-muted">{group.hint}</p>
      {group.id === SLIP_ID ? null : <GroupBar learned={learned} total={total} />}
      <p className="mt-3 text-sm text-muted">
        {group.due} due · {group.learning} learning · {group.fresh} new · {group.known} known
      </p>
      <ul className="mt-3 flex flex-col">
        {preview.map((id) => {
          const word = wordById(id);
          const row = progress[id];
          if (!word || !row) return null;
          return (
            <li key={id} className="flex items-baseline justify-between gap-3 border-t border-line py-2 first:border-t-0">
              <span className="font-medium">{word.lemma}</span>
              <span className="text-sm text-muted">{bandLabel(wordBand(row, now))}</span>
            </li>
          );
        })}
      </ul>
      {group.words.length > preview.length ? (
        <p className="text-sm text-muted">and {group.words.length - preview.length} more</p>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to="/review"
          search={{ mode: "practice", topic: group.id }}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-3 text-sm font-medium text-paper"
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
    </div>
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
      className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-paper text-ink"
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
