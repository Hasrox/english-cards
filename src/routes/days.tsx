import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BootScreen, Frame, ProblemScreen } from "@/components/chrome";
import { badgeList, FACES, faceSrc, hoursLabel, monthCells, monthTitle, studiedCount } from "@/lib/cards/practice";
import { streakFact } from "@/lib/cards/stats";
import { useVault } from "@/lib/cards/store";
import { dayKey } from "@/lib/cards/time";

export const Route = createFileRoute("/days")({ component: DaysPage });

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

function DaysPage() {
  const ready = useVault((state) => state.ready);
  const listsReady = useVault((state) => state.listsReady);
  const error = useVault((state) => state.error);
  if (error) return <ProblemScreen message={error} />;
  if (!ready || !listsReady) return <BootScreen />;
  return <Days />;
}

function Days() {
  const log = useVault((state) => state.log);
  const streak = useVault((state) => state.streak);
  const progress = useVault((state) => state.progress);
  const setAvatar = useVault((state) => state.setAvatar);
  const [picking, setPicking] = useState(false);
  const today = dayKey();
  const practiced = new Set(log.days);
  const cells = monthCells();
  const stamps = badgeList(log, progress, streak.count);
  const row = streakFact(streak);
  const earned = stamps.filter((stamp) => stamp.earned).length;

  return (
    <Frame dock>
      <header className="safe-top px-6 pb-2">
        <div className="flex items-center gap-4">
          <button type="button" aria-label="Choose a face" className="rounded-full" onClick={() => setPicking((open) => !open)}>
            <img src={faceSrc(log.avatar)} alt="" className="size-20 rounded-full object-cover" />
          </button>
          <div>
            <h1 className="font-display text-4xl tracking-tight">Your rank</h1>
            <p className="mt-1 text-sm text-muted">{earned} of {stamps.length} stamps</p>
          </div>
        </div>
        {picking ? (
          <div className="mt-4 flex gap-3">
            {FACES.map((face) => (
              <button
                key={face.id}
                type="button"
                aria-label={face.label}
                aria-pressed={log.avatar === face.id}
                className={`rounded-full ${log.avatar === face.id ? "ring-4 ring-accent" : ""}`}
                onClick={() => {
                  void setAvatar(face.id);
                  setPicking(false);
                }}
              >
                <img src={face.src} alt="" className="size-14 rounded-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Tap the picture to change it. Stamps are under the month.</p>
        )}
      </header>
      <main className="flex flex-col gap-6 px-6 pt-4 pb-8">
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-line bg-card px-4 py-4">
            <p className="font-display text-4xl tracking-tight">{streak.count}</p>
            <p className="mt-1 text-sm text-muted">{row ?? "Days in a row"}</p>
          </div>
          <div className="rounded-3xl border border-line bg-card px-4 py-4">
            <p className="font-display text-3xl tracking-tight">{hoursLabel(log.ms)}</p>
            <p className="mt-1 text-sm text-muted">{studiedCount(progress)} words studied</p>
          </div>
        </section>
        <section>
          <h2 className="font-display text-2xl tracking-tight">{monthTitle()}</h2>
          <p className="mt-1 text-sm text-pretty text-muted">
            A day fills in after you finish a quiz or a game. Miss a day and the row starts over. Hours count only while a quiz or a game is on the screen. Opening the app adds nothing.
          </p>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-muted">
            {WEEK.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              if (!cell.inMonth) return <span key={cell.key} />;
              const on = practiced.has(cell.key);
              const isToday = cell.key === today;
              return (
                <span
                  key={cell.key}
                  className={`flex h-10 items-center justify-center rounded-full text-sm ${
                    on ? "bg-accent font-medium text-paper" : isToday ? "ring-2 ring-accent text-ink" : "text-muted"
                  }`}
                >
                  {cell.day}
                </span>
              );
            })}
          </div>
        </section>
        <section>
          <h2 className="font-display text-2xl tracking-tight">Stamps</h2>
          <ul className="mt-3 grid grid-cols-3 gap-3">
            {stamps.map((stamp) => (
              <li key={stamp.id} className={`rounded-3xl border border-line bg-card p-2 text-center ${stamp.earned ? "" : "opacity-45 grayscale"}`}>
                <img src={stamp.src} alt="" className="mx-auto size-16 rounded-2xl object-cover" />
                <p className="mt-2 text-sm font-medium">{stamp.title}</p>
                <p className="text-xs text-muted">{stamp.earned ? "Got it" : stamp.need}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </Frame>
  );
}
