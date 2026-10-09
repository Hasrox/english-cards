import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BootScreen, ProblemScreen } from "@/components/chrome";
import { ReviewSession } from "@/components/review-session";
import { readGroupId } from "@/lib/cards/groups";
import { useVault } from "@/lib/cards/store";

type ReviewSearch = {
  mode?: "practice";
  topic?: string;
  words?: string[];
};

const MAX_PINNED_WORDS = 32;

function readWordIds(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  const ids = raw
    .filter(
      (item): item is string => typeof item === "string" && item.length > 0 && item.length < 80,
    )
    .slice(0, MAX_PINNED_WORDS);
  return ids.length > 0 ? ids : undefined;
}

export const Route = createFileRoute("/review")({
  validateSearch: (search: Record<string, unknown>): ReviewSearch => {
    const topic = readGroupId(search.topic);
    const words = readWordIds(search.words);
    return {
      ...(search.mode === "practice" ? { mode: "practice" as const } : {}),
      ...(topic ? { topic } : {}),
      ...(words ? { words } : {}),
    };
  },
  component: ReviewPage,
});

function ReviewPage() {
  const ready = useVault((state) => state.ready);
  const listsReady = useVault((state) => state.listsReady);
  const error = useVault((state) => state.error);
  const { mode, topic, words } = Route.useSearch();
  const [round, setRound] = useState(0);
  if (error) return <ProblemScreen message={error} />;
  if (!ready || !listsReady) return <BootScreen />;
  return (
    <ReviewSession
      key={`${mode ?? "scheduled"}:${topic ?? ""}:${(words ?? []).join(",")}:${round}`}
      mode={mode === "practice" ? "practice" : "scheduled"}
      topic={topic}
      words={words}
      round={round}
      onAgain={() => setRound((value) => value + 1)}
    />
  );
}
