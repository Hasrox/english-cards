import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { wordById } from "@/data/words";
import { BootScreen, Frame, ProblemScreen } from "@/components/chrome";
import { LearningSession } from "@/components/learning-session";
import { readGroupId } from "@/lib/cards/groups";
import { learningBatch, type LearnWordInfo } from "@/lib/cards/learning";
import { useVault } from "@/lib/cards/store";

/**
 * `/learn` — New-only teach path (v0.65).
 * Batch freezes at open; session state machine lives in LearningSession.
 * Dock stays hidden (see `showDock`).
 */

type LearnSearch = {
  topic?: string;
};

export const Route = createFileRoute("/learn")({
  validateSearch: (search: Record<string, unknown>): LearnSearch => {
    const topic = readGroupId(search.topic);
    return topic ? { topic } : {};
  },
  component: LearnPage,
});

function learnLookup(id: string): LearnWordInfo | undefined {
  const word = wordById(id);
  if (!word) return undefined;
  return {
    id: word.id,
    lemma: word.lemma,
    rank: word.rank,
    topic: word.topic,
    pos: word.pos,
    ar: word.ar,
  };
}

function LearnPage() {
  const ready = useVault((state) => state.ready);
  const listsReady = useVault((state) => state.listsReady);
  const error = useVault((state) => state.error);
  const { topic } = Route.useSearch();
  if (error) return <ProblemScreen message={error} />;
  if (!ready || !listsReady) return <BootScreen />;
  return <LearnRouteBody topic={topic} />;
}

function LearnRouteBody({ topic }: { topic?: string }) {
  const progress = useVault((state) => state.progress);
  const settings = useVault((state) => state.settings);

  // Batch is frozen at session open (same idea as review queue).
  const batchIds = useMemo(
    () => learningBatch(progress, settings, Date.now(), learnLookup, topic),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const emptyTitle =
    topic != null
      ? "No new words in this group today."
      : "No new words left for today.";
  const emptyDetail =
    topic != null
      ? "Today’s new limit still applies here. Try another group, or come back tomorrow."
      : "The daily new limit is used, or the deck has no New cards left to teach.";

  if (batchIds.length === 0) {
    return (
      <Frame>
        <header className="safe-top flex items-baseline justify-between px-5 pb-3">
          <p className="text-sm text-muted">Learn</p>
          <Link to="/" className="min-h-11 text-sm text-muted">
            Close
          </Link>
        </header>
        <main className="flex flex-1 flex-col justify-center px-6 pb-8">
          <h1 className="font-display text-4xl tracking-tight text-balance">{emptyTitle}</h1>
          <p className="mt-3 max-w-sm text-pretty text-muted">{emptyDetail}</p>
          <Link
            to="/"
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper"
          >
            Back to today
          </Link>
          <Link
            to="/review"
            search={{ mode: "practice" }}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-line px-5 text-base font-medium"
          >
            Practice again
          </Link>
        </main>
      </Frame>
    );
  }

  return <LearningSession batchIds={batchIds} topic={topic} />;
}
