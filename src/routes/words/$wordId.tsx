import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { sourceLabel, wordById } from "@/data/words";
import { BootScreen, Frame, GhostButton, ProblemScreen } from "@/components/chrome";
import { ExampleLine } from "@/components/example-line";
import { GroupPicker } from "@/components/group-picker";
import { PicturePicker } from "@/components/picture-picker";
import { readPicture } from "@/lib/cards/db";
import { isNewState } from "@/lib/cards/fsrs";
import { speakEnglish } from "@/lib/cards/speech";
import { useVault } from "@/lib/cards/store";
import { dueLabel } from "@/lib/cards/time";
import { LEECH_AT } from "@/lib/cards/types";

export const Route = createFileRoute("/words/$wordId")({ component: WordPage });

function WordPage() {
  const ready = useVault((state) => state.ready);
  const listsReady = useVault((state) => state.listsReady);
  const error = useVault((state) => state.error);
  const { wordId } = Route.useParams();
  if (error) return <ProblemScreen message={error} />;
  if (!ready || !listsReady) return <BootScreen />;
  return <WordDetail wordId={wordId} />;
}

function WordDetail({ wordId }: { wordId: string }) {
  const word = useVault((state) => state.own.find((item) => item.id === wordId)) ?? wordById(wordId);
  const progress = useVault((state) => state.progress[wordId]);
  const setArabic = useVault((state) => state.setArabic);
  const setTopic = useVault((state) => state.setTopic);
  const clearPicture = useVault((state) => state.clearPicture);
  const setRetired = useVault((state) => state.setRetired);
  const removeFromDeck = useVault((state) => state.removeFromDeck);
  const navigate = Route.useNavigate();
  const [draft, setDraft] = useState("");
  const [picker, setPicker] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!word || !progress) return;
    setDraft(progress.arabic ?? word.ar);
  }, [word, progress]);

  useEffect(() => {
    if (!progress?.hasPicture) {
      setPictureUrl(null);
      return;
    }
    let dead = false;
    let objectUrl: string | null = null;
    void readPicture(wordId).then((picture) => {
      if (dead || !picture) return;
      objectUrl = URL.createObjectURL(picture.blob);
      setPictureUrl(objectUrl);
    });
    return () => {
      dead = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [wordId, progress?.hasPicture, progress?.pictureRev]);

  if (!word || !progress) {
    return (
      <Frame dock>
        <main className="flex flex-1 flex-col justify-center px-6">
          <h1 className="font-display text-4xl">Not in the deck</h1>
          <Link to="/words" className="mt-6 text-accent">
            Back to words
          </Link>
        </main>
      </Frame>
    );
  }

  const leech = progress.failCount >= LEECH_AT;
  const dirty = draft.trim() !== (progress.arabic ?? word.ar);
  const status = progress.retired ? "Retired" : isNewState(progress.card.state) ? "Not started" : dueLabel(progress.card.due);

  async function saveGloss() {
    const trimmed = draft.trim();
    if (!trimmed || !word) return;
    await setArabic(word.id, trimmed === word.ar ? null : trimmed);
  }

  return (
    <Frame dock>
      <header className="safe-top px-5">
        <Link to="/words" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted">
          <ChevronLeft aria-hidden="true" className="size-4" />
          Words
        </Link>
      </header>
      <main className="flex flex-1 flex-col px-5 pb-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-muted uppercase">
              {word.pos} · {sourceLabel(word.source)}
            </p>
            <h1 className="mt-1 font-display text-5xl tracking-tight">{word.lemma}</h1>
          </div>
          <button
            type="button"
            aria-label={`Play ${word.lemma}`}
            className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-card"
            onClick={() => speakEnglish(word.lemma)}
          >
            <img src="/ui/speak.png" alt="" className="size-7 object-contain" />
          </button>
        </div>
        <p className="mt-3 text-sm text-muted">{status}</p>
        {leech ? (
          <div className="mt-5 rounded-3xl border border-line bg-card px-4 py-4">
            <p className="text-sm text-pretty">
              Flagged after {progress.failCount} misses. A wrong picture or the wrong Arabic sense is the usual cause. It stays in the deck.
            </p>
            <div className="mt-3 flex gap-2">
              <GhostButton type="button" className="border border-line bg-paper" onClick={() => setPicker(true)}>
                Change picture
              </GhostButton>
              <GhostButton
                type="button"
                onClick={() => document.getElementById("gloss")?.focus()}
              >
                Edit Arabic
              </GhostButton>
            </div>
          </div>
        ) : null}
        <label htmlFor="gloss" className="mt-8 text-sm text-muted">
          Arabic
          {progress.arabic ? " · edited on this phone" : ""}
        </label>
        <textarea
          id="gloss"
          dir="rtl"
          lang="ar"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (dirty) void saveGloss();
          }}
          rows={3}
          className="font-arabic mt-2 w-full rounded-3xl border border-line bg-card px-4 py-3 text-right text-2xl leading-relaxed text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
        <div className="mt-3 flex gap-2">
          <GhostButton type="button" className="border border-line bg-card" disabled={!dirty} onClick={() => void saveGloss()}>
            Save gloss
          </GhostButton>
          {progress.arabic ? (
            <GhostButton
              type="button"
              onClick={() => {
                setDraft(word.ar);
                void setArabic(word.id, null);
              }}
            >
              Use the shipped line
            </GhostButton>
          ) : null}
        </div>
        <div className="mt-8">
          {word.example ? <ExampleLine example={word.example} highlight={word.highlight} /> : (
            <p className="text-sm text-muted">No example shipped with this word.</p>
          )}
        </div>
        {word.source === "mine" ? (
          <div className="mt-8">
            <GroupPicker value={word.topic} onChange={(topic) => void setTopic(word.id, topic)} />
          </div>
        ) : null}
        <div className="mt-8">
          {pictureUrl ? (
            <div className="flex h-56 w-full items-center justify-center overflow-hidden rounded-3xl bg-paper">
              <img src={pictureUrl} alt="" className="max-h-full max-w-full object-contain" />
            </div>
          ) : null}
          {progress.credit ? (
            <a href={progress.credit.sourceUrl} className="mt-2 block text-xs text-muted" target="_blank" rel="noreferrer">
              Photo by {progress.credit.creator}
              {progress.credit.license ? ` · ${progress.credit.license}` : ""}
            </a>
          ) : null}
          {word.abstract && !progress.hasPicture ? (
            <p className="mt-3 text-sm text-pretty text-muted">A picture is unlikely to help this word. The example carries it.</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <GhostButton type="button" className="border border-line bg-card" onClick={() => setPicker(true)}>
              {progress.hasPicture ? "Change picture" : "Add a picture"}
            </GhostButton>
            {progress.hasPicture ? (
              <GhostButton type="button" onClick={() => void clearPicture(word.id)}>
                Remove picture
              </GhostButton>
            ) : null}
          </div>
        </div>
        <div className="mt-12 border-t border-line pt-6">
          {progress.retired ? (
            <>
              <p className="text-sm text-muted">Retired. It will not return until you restore it.</p>
              <GhostButton type="button" className="mt-3 border border-line bg-card" onClick={() => void setRetired(word.id, false)}>
                Restore
              </GhostButton>
            </>
          ) : confirmRetire ? (
            <div className="flex gap-2">
              <GhostButton type="button" className="border border-line bg-card" onClick={() => void setRetired(word.id, true)}>
                Retire this word
              </GhostButton>
              <GhostButton type="button" onClick={() => setConfirmRetire(false)}>
                Cancel
              </GhostButton>
            </div>
          ) : (
            <GhostButton type="button" onClick={() => setConfirmRetire(true)}>
              Retire
            </GhostButton>
          )}
          <GhostButton
            type="button"
            className="mt-4"
            onClick={() => {
              void removeFromDeck(word.id).then(() => navigate({ to: "/words" }));
            }}
          >
            Remove from my words
          </GhostButton>
        </div>
      </main>
      <PicturePicker wordId={word.id} lemma={word.lemma} open={picker} onClose={() => setPicker(false)} />
    </Frame>
  );
}
