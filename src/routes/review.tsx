import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BootScreen, ProblemScreen } from "@/components/chrome";
import { ReviewSession } from "@/components/review-session";
import { readGroupId } from "@/lib/cards/groups";
import { useVault } from "@/lib/cards/store";

type ReviewSearch = {
  mode?: "practice";
  topic?: string;
};

export const Route = createFileRoute("/review")({
  validateSearch: (search: Record<string, unknown>): ReviewSearch => {
    const topic = readGroupId(search.topic);
    return {
      ...(search.mode === "practice" ? { mode: "practice" as const } : {}),
      ...(topic ? { topic } : {}),
    };
  },
  component: ReviewPage,
});

function ReviewPage() {
  const ready = useVault((state) => state.ready);
  const listsReady = useVault((state) => state.listsReady);
  const error = useVault((state) => state.error);
  const { mode, topic } = Route.useSearch();
  const [round, setRound] = useState(0);
  if (error) return <ProblemScreen message={error} />;
  if (!ready || !listsReady) return <BootScreen />;
  return (
    <ReviewSession
      key={`${mode ?? "scheduled"}:${topic ?? ""}:${round}`}
      mode={mode === "practice" ? "practice" : "scheduled"}
      topic={topic}
      round={round}
      onAgain={() => setRound((value) => value + 1)}
    />
  );
}

