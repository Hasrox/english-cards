import { createFileRoute } from "@tanstack/react-router";
import { LettersGame } from "@/components/games/letters";
import { BootScreen, ProblemScreen } from "@/components/chrome";
import { readGroupId } from "@/lib/cards/groups";
import { useVault } from "@/lib/cards/store";

export const Route = createFileRoute("/play/letters")({
  validateSearch: (search: Record<string, unknown>): { topic?: string } => {
    const topic = readGroupId(search.topic);
    return topic ? { topic } : {};
  },
  component: LettersPage,
});

function LettersPage() {
  const ready = useVault((state) => state.ready);
  const listsReady = useVault((state) => state.listsReady);
  const error = useVault((state) => state.error);
  const { topic } = Route.useSearch();
  if (error) return <ProblemScreen message={error} />;
  if (!ready || !listsReady) return <BootScreen />;
  return <LettersGame topic={topic} />;
}
