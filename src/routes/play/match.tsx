import { createFileRoute } from "@tanstack/react-router";
import { MatchGame } from "@/components/games/match";
import { BootScreen, ProblemScreen } from "@/components/chrome";
import { readGroupId } from "@/lib/cards/groups";
import { useVault } from "@/lib/cards/store";

export const Route = createFileRoute("/play/match")({
  validateSearch: (search: Record<string, unknown>): { topic?: string } => {
    const topic = readGroupId(search.topic);
    return topic ? { topic } : {};
  },
  component: MatchPage,
});

function MatchPage() {
  const ready = useVault((state) => state.ready);
  const listsReady = useVault((state) => state.listsReady);
  const error = useVault((state) => state.error);
  const { topic } = Route.useSearch();
  if (error) return <ProblemScreen message={error} />;
  if (!ready || !listsReady) return <BootScreen />;
  return <MatchGame topic={topic} />;
}
