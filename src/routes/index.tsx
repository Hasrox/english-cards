import { createFileRoute, Link } from "@tanstack/react-router";
import { WORD_COUNT } from "@/data/words";
import { BootScreen, Frame, ProblemScreen } from "@/components/chrome";
import { studySnapshot, streakFact } from "@/lib/cards/stats";
import { useVault } from "@/lib/cards/store";
import { weekdayLabel } from "@/lib/cards/time";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const ready = useVault((state) => state.ready);
  const error = useVault((state) => state.error);
  if (error) return <ProblemScreen message={error} />;
  if (!ready) return <BootScreen />;
  return <Today />;
}

function Today() {
  const progress = useVault((state) => state.progress);
  const settings = useVault((state) => state.settings);
  const streak = useVault((state) => state.streak);
  const snap = studySnapshot(progress, settings);
  const fact = streakFact(streak);
  const deckCount = Object.keys(progress).length;
  const alive = Object.values(progress).filter((row) => !row.retired).length;
  const nextClock = snap.upcoming
    ? new Date(snap.upcoming).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  let title = "Add the words you want.";
  let detail = "Type your own, or take them from the open lists. Nothing is studied until you add it.";
  if (deckCount === 0) {
    title = "Add the words you want.";
    detail = "Type your own, or take them from the open lists. Nothing is studied until you add it.";
  } else if (snap.dueCount > 0) {
    title = snap.dueCount === 1 ? "1 card is due." : `${snap.dueCount} cards are due.`;
    detail = "Reviews come first. Pick the right word from four in the same group. A miss counts as didn't know.";
  } else if (snap.newLeft > 0) {
    title = "No reviews waiting.";
    detail = `${snap.newLeft} new ${snap.newLeft === 1 ? "word" : "words"} can start today. Pick the right word from four in the same group.`;
  } else {
    title = "Nothing is scheduled.";
    detail =
      alive > 0
        ? "You do not have to wait until tomorrow. Practice the words again, or play a game."
        : "The deck has nothing left to start.";
  }

  return (
    <Frame dock>
      <header className="safe-top flex items-center justify-between px-6 pb-2">
        <p className="text-sm text-muted">{weekdayLabel()}</p>
        <Link to="/settings" aria-label="Settings" className="inline-flex size-11 items-center justify-center rounded-full text-ink">
          <img src="/ui/settings.png" alt="" className="size-7 object-contain" />
        </Link>
      </header>
      <main className="flex flex-1 flex-col px-6 pb-8">
        <h1 className="font-display text-5xl tracking-tight text-balance">English Cards</h1>
        {deckCount === 0 ? (
          <img src="/ui/empty-deck.png" alt="" className="mt-6 h-40 w-full object-contain" />
        ) : null}
        <p className="mt-4 font-display text-3xl leading-tight tracking-tight text-balance">{title}</p>
        <p className="mt-3 max-w-sm text-pretty text-muted">{detail}</p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Stat value={snap.dueCount} label="Due" />
          <Stat value={snap.newLeft} label="New today" />
        </div>
        {snap.reviewsFirst ? (
          <p className="mt-5 text-sm text-ink">Reviews first today. New words wait.</p>
        ) : null}
        {!snap.canStart && nextClock ? (
          <p className="mt-5 text-sm text-muted">Next card at {nextClock}.</p>
        ) : null}
        {snap.canStart ? (
          <Link
            to="/review"
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper"
          >
            {snap.dueCount > 0 ? "Start review" : "Learn new words"}
          </Link>
        ) : deckCount === 0 ? (
          <Link
            to="/words"
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper"
          >
            Add words
          </Link>
        ) : null}
        {alive > 0 ? (
          <Link
            to="/review"
            search={{ mode: "practice" }}
            className={`inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 text-base font-medium ${
              snap.canStart ? "mt-3 border border-line" : "mt-8 bg-accent text-paper"
            }`}
          >
            Practice again
          </Link>
        ) : null}
        {fact ? <p className="mt-6 text-sm tabular-nums text-muted">{fact}</p> : null}
        <p className="mt-auto pt-10 text-sm text-muted">
          <Link to="/words" className="text-ink underline decoration-line underline-offset-4">
            Words
          </Link>
          <span>
            {" "}
            · {deckCount} in your deck · {WORD_COUNT.toLocaleString()} in the open lists
          </span>
        </p>
      </main>
    </Frame>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-3xl border border-line bg-card px-4 py-4">
      <p className="font-display text-4xl tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}
