import { createFileRoute, Link } from "@tanstack/react-router";
import { BootScreen, Frame, ProblemScreen } from "@/components/chrome";
import { readGroupId, topicLabel, SLIP_ID } from "@/lib/cards/groups";
import { useVault } from "@/lib/cards/store";

export const Route = createFileRoute("/play/")({
  validateSearch: (search: Record<string, unknown>): { topic?: string } => {
    const topic = readGroupId(search.topic);
    return topic ? { topic } : {};
  },
  component: PlayPage,
});

function PlayPage() {
  const ready = useVault((state) => state.ready);
  const listsReady = useVault((state) => state.listsReady);
  const error = useVault((state) => state.error);
  if (error) return <ProblemScreen message={error} />;
  if (!ready || !listsReady) return <BootScreen />;
  return <PlayHub />;
}

function PlayHub() {
  const { topic } = Route.useSearch();
  const deck = useVault((state) => Object.keys(state.progress).length);
  const search = topic ? { topic } : {};
  const where =
    topic === SLIP_ID ? "Slipping words" : topic ? topicLabel(topic.split(":")[0] ?? topic) : "Your deck";

  return (
    <Frame dock>
      <header className="safe-top px-6 pb-2">
        <h1 className="font-display text-5xl tracking-tight">Play</h1>
        <p className="mt-3 max-w-sm text-pretty text-muted">
          Same cards, another way to recall them. Play as many rounds as you want today. A miss brings the word back. Getting it right does not make you wait until tomorrow.
        </p>
        <p className="mt-3 text-sm text-muted">Using {where}{deck === 0 ? " — add words first" : ""}.</p>
      </header>
      <main className="flex flex-col gap-3 px-6 pt-4">
        <GameLink to="/play/letters" search={search} title="Missing letter" detail="One letter is gone. Put it back." mark="/ui/game-letter.png" />
        <GameLink to="/play/match" search={search} title="Match" detail="Flip the English and the Arabic that belong together." mark="/ui/game-match.png" />
        <GameLink to="/play/connect" search={search} title="Connect" detail="Tap a word, then tap its meaning." mark="/ui/game-connect.png" />
        <Link to="/island" className="mt-2 text-sm text-ink underline decoration-line underline-offset-4">
          Pick a group on the island
        </Link>
      </main>
    </Frame>
  );
}

function GameLink({
  to,
  search,
  title,
  detail,
  mark,
}: {
  to: "/play/letters" | "/play/match" | "/play/connect";
  search: { topic?: string };
  title: string;
  detail: string;
  mark: string;
}) {
  return (
    <Link to={to} search={search} className="flex items-center gap-4 rounded-3xl border border-line bg-card px-4 py-4">
      <img src={mark} alt="" className="h-12 w-16 shrink-0 object-contain" />
      <span>
        <span className="font-display text-3xl tracking-tight">{title}</span>
        <span className="mt-1 block text-sm text-pretty text-muted">{detail}</span>
      </span>
    </Link>
  );
}
