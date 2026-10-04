import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { wordById, type Pos, type Word } from "@/data/words";
import { BootScreen, Frame, ProblemScreen } from "@/components/chrome";
import { GroupBar } from "@/components/group-bar";
import { GroupPicker } from "@/components/group-picker";
import { isNewState } from "@/lib/cards/fsrs";
import { LIST_GROUPS, groupStats, topicLabel, wordGroups } from "@/lib/cards/groups";
import { categoryArt } from "@/lib/cards/category-art";
import { useVault } from "@/lib/cards/store";
import { dueLabel } from "@/lib/cards/time";
import { LEECH_AT } from "@/lib/cards/types";

export const Route = createFileRoute("/words/")({ component: WordsPage });

function easiestPending(words: Word[], progress: Record<string, { retired?: boolean } | undefined>, count = 20): Word[] {
  return words
    .filter((word) => !progress[word.id])
    .sort((a, b) => a.rank - b.rank || a.lemma.localeCompare(b.lemma))
    .slice(0, count);
}

const POS_OPTIONS: Pos[] = ["noun", "verb", "adjective", "adverb", "preposition", "pronoun", "determiner", "conjunction", "number"];

function WordsPage() {
  const ready = useVault((state) => state.ready);
  const listsReady = useVault((state) => state.listsReady);
  const error = useVault((state) => state.error);
  if (error) return <ProblemScreen message={error} />;
  if (!ready || !listsReady) return <BootScreen />;
  return <WordList />;
}

function WordList() {
  const progress = useVault((state) => state.progress);
  const own = useVault((state) => state.own);
  const library = useVault((state) => state.library);
  const addToDeck = useVault((state) => state.addToDeck);
  const addOwn = useVault((state) => state.addOwn);
  const [tab, setTab] = useState<"mine" | "lists">("mine");
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(40);
  const [lemma, setLemma] = useState("");
  const [arabic, setArabic] = useState("");
  const [example, setExample] = useState("");
  const [pos, setPos] = useState<Pos>("noun");
  const [topic, setTopic] = useState("food");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const needle = query.trim().toLowerCase();

  const deckRows = useMemo(() => {
    const rows = Object.keys(progress)
      .map((id) => wordById(id))
      .filter((word) => word != null);
    const filtered = needle
      ? rows.filter(
          (word) =>
            word.lemma.toLowerCase().includes(needle) ||
            word.ar.includes(query.trim()) ||
            (progress[word.id]?.arabic ?? "").includes(query.trim()),
        )
      : rows;
    return filtered.sort((a, b) => a.rank - b.rank || a.lemma.localeCompare(b.lemma));
  }, [needle, progress, query]);

  const libraryRows = useMemo(() => {
    const ownOnly = own.filter((word) => !library.some((item) => item.id === word.id));
    const pool = tab === "lists" ? [...ownOnly, ...library] : [];
    return pool.filter((word) => {
      if (category && !needle && !wordGroups(word).includes(category)) return false;
      if (!needle) return true;
      return word.lemma.toLowerCase().includes(needle) || word.ar.includes(query.trim());
    });
  }, [category, needle, own, query, tab, library]);

  const categories = useMemo(() => {
    const ids = new Set(library.map((word) => word.id));
    const pool = library.concat(own.filter((word) => !ids.has(word.id)));
    const stats = groupStats(pool, progress);
    return LIST_GROUPS.map((id) => {
      const words = pool.filter((word) => wordGroups(word).includes(id));
      const left = words.filter((word) => !progress[word.id]).length;
      const count = stats.get(id) ?? { total: words.length, learned: 0 };
      return { id, words, left, learned: count.learned, total: count.total };
    }).filter((group) => group.words.length > 0);
  }, [library, own, progress]);

  async function onAddOwn() {
    setBusy(true);
    setNote("");
    try {
      const id = await addOwn({ lemma, ar: arabic, example, pos, topic });
      setLemma("");
      setArabic("");
      setExample("");
      const added = wordById(id);
      setNote(
        added && added.source !== "mine"
          ? `Added. It was already listed under ${topicLabel(added.topic)}.`
          : `Added to ${topicLabel(topic)}.`,
      );
      setTab("mine");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "That word could not be added.");
    } finally {
      setBusy(false);
    }
  }

  async function onAddGroup(words: Word[], label: string) {
    setBusy(true);
    const batch = easiestPending(words, progress);
    const count = await addToDeck(batch.map((word) => word.id));
    setNote(count === 0 ? `Those ${label} words are already in your deck.` : `Added ${count} from ${label}.`);
    setBusy(false);
    setTab("mine");
  }

  return (
    <Frame dock>
      <header className="safe-top px-5 pb-3">
        <Link to="/" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Today
        </Link>
        <h1 className="mt-2 font-display text-4xl tracking-tight">Words</h1>
        <p className="mt-2 text-sm text-pretty text-muted">
          Your deck is only what you add. The open lists are there to pick from.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <TabButton active={tab === "mine"} onClick={() => { setTab("mine"); setLimit(40); }}>
            Mine · {Object.keys(progress).length}
          </TabButton>
          <TabButton active={tab === "lists"} onClick={() => { setTab("lists"); setLimit(40); setCategory(null); }}>
            Lists · {library.length}
          </TabButton>
        </div>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(40);
          }}
          aria-label="Find a word"
          placeholder="Find a word"
          className="mt-3 min-h-12 w-full rounded-full border border-line bg-card px-4 text-ink outline-none placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
      </header>
      {tab === "mine" ? (
        <section className="px-5 pb-4">
          <h2 className="text-sm font-medium">Add your own</h2>
          <div className="mt-3 flex flex-col gap-2">
            <input
              value={lemma}
              onChange={(event) => setLemma(event.target.value)}
              aria-label="English word"
              placeholder="English word"
              className="min-h-12 w-full rounded-2xl border border-line bg-card px-4 text-ink outline-none placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />
            <textarea
              value={arabic}
              onChange={(event) => setArabic(event.target.value)}
              aria-label="Arabic"
              dir="rtl"
              lang="ar"
              rows={2}
              placeholder="العربية"
              className="font-arabic w-full rounded-2xl border border-line bg-card px-4 py-3 text-right text-xl text-ink outline-none placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />
            <input
              value={example}
              onChange={(event) => setExample(event.target.value)}
              aria-label="Example sentence"
              placeholder="Example, optional"
              className="min-h-12 w-full rounded-2xl border border-line bg-card px-4 text-ink outline-none placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />
            <GroupPicker value={topic} onChange={setTopic} />
            <label className="flex items-center justify-between gap-3 text-sm text-muted">
              Part of speech
              <select
                value={pos}
                onChange={(event) => setPos(event.target.value as Pos)}
                className="min-h-11 rounded-full border border-line bg-card px-3 text-ink"
              >
                {POS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !lemma.trim() || !arabic.trim()}
              onClick={() => void onAddOwn()}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-paper disabled:opacity-40"
            >
              Add to my words
            </button>
            {note ? <p className="text-sm text-muted">{note}</p> : null}
          </div>
        </section>
      ) : category && !needle ? (
        <div className="px-5 pb-3">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1 text-sm text-muted"
            onClick={() => {
              setCategory(null);
              setLimit(40);
            }}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            All groups
          </button>
          <div className="mt-2 flex items-center gap-3">
            <img src={categoryArt(category)} alt="" className="size-14 shrink-0 rounded-full object-cover" />
            <p className="text-sm text-pretty text-muted">
              Add the 20 most common ones that are not in your deck yet, or add a single word below. Learning a word fills every group it belongs to.
            </p>
          </div>
          {(() => {
            const group = categories.find((item) => item.id === category);
            if (!group) return null;
            const batch = Math.min(20, group.left);
            return (
              <>
                <GroupBar learned={group.learned} total={group.total} />
                {batch === 0 ? (
                  <p className="mt-3 text-sm text-muted">All of these are in your deck.</p>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onAddGroup(group.words, topicLabel(group.id))}
                    className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-paper disabled:opacity-40"
                  >
                    {batch === 20 ? `Add 20 ${topicLabel(group.id)} words` : `Add the last ${batch}`}
                  </button>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        <p className="px-5 pb-3 text-sm text-pretty text-muted">
          Groups are by meaning. Top 100 and Top 500 are the most common words, so a word can sit in more than one group. Learning it fills every bar it belongs to.
        </p>
      )}
      {tab === "lists" && !needle && !category ? (
        <ul className="flex flex-col gap-3 px-5 pb-8">
          {categories.map((group) => {
            const batch = Math.min(20, group.left);
            return (
              <li key={group.id} className="rounded-3xl border border-line bg-card px-4 py-4">
                <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => { setCategory(group.id); setLimit(40); }}>
                  <img src={categoryArt(group.id)} alt="" className="size-16 shrink-0 rounded-full object-cover" />
                  <span>
                    <span className="font-display text-3xl tracking-tight">{topicLabel(group.id)}</span>
                    <span className="mt-1 block text-sm text-muted">
                      {group.words.length} words · {group.left} not in your deck
                    </span>
                  </span>
                </button>
                <GroupBar learned={group.learned} total={group.total} />
                {batch > 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onAddGroup(group.words, topicLabel(group.id))}
                    className="mt-3 inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-medium text-paper disabled:opacity-40"
                  >
                    {batch === 20 ? "Add 20" : `Add the last ${batch}`}
                  </button>
                ) : (
                  <p className="mt-3 text-sm text-muted">All of these are in your deck.</p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
      <ul className="flex-1 px-5 pb-8">
        {tab === "mine" && deckRows.length === 0 ? (
          <li className="py-6 text-sm text-pretty text-muted">
            Nothing in your deck yet. Add a word above, or open the lists.
          </li>
        ) : null}
        {tab === "lists" && libraryRows.length === 0 ? <li className="py-8 text-sm text-muted">No word matches.</li> : null}
        {tab === "mine"
          ? deckRows.map((word) => {
              const row = progress[word.id];
              const status = !row || row.retired
                ? row?.retired
                  ? "Retired"
                  : "Not started"
                : isNewState(row.card.state)
                  ? "Not started"
                  : dueLabel(row.card.due);
              const leech = (row?.failCount ?? 0) >= LEECH_AT;
              return (
                <li key={word.id} className="border-b border-line">
                  <Link
                    to="/words/$wordId"
                    params={{ wordId: word.id }}
                    className="flex min-h-14 items-center justify-between gap-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block font-display text-2xl tracking-tight">{word.lemma}</span>
                      <span lang="ar" dir="rtl" className="font-arabic mt-0.5 block text-sm text-muted">
                        {row?.arabic ?? word.ar}
                      </span>
                      {word.source === "mine" ? (
                        <span className="text-xs text-muted">
                          {word.topic === "mine" ? "Pick a group" : topicLabel(word.topic)}
                        </span>
                      ) : null}
                      {row?.hasPicture ? <span className="ml-2 text-xs text-muted">Picture</span> : null}
                      {leech ? <span className="ml-2 text-xs text-accent">Flagged</span> : null}
                    </span>
                    <span className="shrink-0 text-sm text-muted">{status}</span>
                  </Link>
                </li>
              );
            })
          : libraryRows.slice(0, limit).map((word) => {
              const inDeck = Boolean(progress[word.id]);
              return (
                <li key={word.id} className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-3">
                  <span className="min-w-0">
                    <span className="font-display text-2xl tracking-tight">{word.lemma}</span>
                    <span lang="ar" dir="rtl" className="font-arabic ms-2 text-sm text-muted">
                      {word.ar}
                    </span>
                    <span className="mt-1 block text-xs text-muted">{topicLabel(word.topic)}</span>
                  </span>
                  {inDeck ? (
                    <span className="shrink-0 text-sm text-muted">In your words</span>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-accent px-4 text-sm font-medium text-paper"
                      onClick={() => void addToDeck([word.id])}
                    >
                      Add
                    </button>
                  )}
                </li>
              );
            })}
        {tab === "lists" && libraryRows.length > limit ? (
          <li className="py-4">
            <button
              type="button"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-line bg-card text-sm"
              onClick={() => setLimit((value) => value + 60)}
            >
              Show more
            </button>
          </li>
        ) : null}
      </ul>
      )}
    </Frame>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm ${active ? "bg-accent text-paper" : "border border-line bg-card text-ink"}`}
    >
      {children}
    </button>
  );
}
