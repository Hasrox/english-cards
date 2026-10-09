import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { wordById } from "@/data/words";
import { Frame } from "@/components/chrome";
import { ExampleLine } from "@/components/example-line";
import { ScoreReport, Sparkles } from "@/components/score-report";
import { useLocalPicture } from "@/components/use-picture";
import { shuffle } from "@/lib/cards/groups";
import {
  advanceLearnGotIt,
  advanceMatchBoard,
  advanceSpellCorrect,
  advanceTypeCorrect,
  createLearnSession,
  currentBatchWordId,
  learningBatch,
  learnStageProgress,
  learnStageTitle,
  learnTally,
  matchBoards,
  noteSpellRetry,
  noteTypeRetry,
  ratingForWord,
  spellDiff,
  spellPuzzle,
  typeCheck,
  type LearnSession,
  type LearnWordInfo,
  type MatchBoard,
  type MatchBoardPair,
  type MatchMode,
  type SpellDiffCell,
  type SpellPuzzle,
} from "@/lib/cards/learning";
import { playEffect, playFinish } from "@/lib/cards/sounds";
import { canSpeak, speakEnglish } from "@/lib/cards/speech";
import { useVault } from "@/lib/cards/store";
import type { Progress } from "@/lib/cards/types";
import { haptics } from "@/lib/motion/haptics";
import { EASE } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import { m } from "motion/react";

/**
 * Learn session (v0.65).
 * Stages: Learn it → Match it → Spell it → Type it → grade + score → done.
 * Phase 8: introduce via vault `grade` on Type success (quit-safe).
 */

const TYPE_KEYS = "abcdefghijklmnopqrstuvwxyz".split("");

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

function glossFor(wordId: string, progressArabic: string | null | undefined): string {
  const word = wordById(wordId);
  return (progressArabic ?? word?.ar ?? "").trim();
}

export function LearningSession({ batchIds, topic }: { batchIds: string[]; topic?: string }) {
  const progress = useVault((state) => state.progress);
  const settings = useVault((state) => state.settings);
  const grade = useVault((state) => state.grade);
  const markPracticeDay = useVault((state) => state.markPracticeDay);

  const boards = useMemo(
    () => matchBoards(batchIds, progress, learnLookup, { salt: batchIds.length }),
    // Freeze boards with the batch at open (same idea as the queue).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [session, setSession] = useState(() => createLearnSession(batchIds));
  const graded = useRef(new Set<string>());
  const gradeLock = useRef(false);
  const playedEnd = useRef(false);
  const markedDay = useRef(false);

  // Empty match board list → skip straight into Spell when Match is entered.
  useEffect(() => {
    if (session.stage !== "match") return;
    if (boards.length > 0) return;
    setSession((prev) => advanceMatchBoard(prev, 0));
  }, [session.stage, boards.length]);

  // Session end: finish sound once (celebrate path when every word was clean).
  useEffect(() => {
    if (session.stage !== "done" || playedEnd.current) return;
    playedEnd.current = true;
    const tally = learnTally(session);
    if (tally.attempts < 1) return;
    playFinish(tally.correct === tally.attempts);
  }, [session]);

  // Study-family day mark (same idea as quiz completion).
  useEffect(() => {
    if (session.stage !== "done" || markedDay.current) return;
    if (session.batchIds.length < 1) return;
    markedDay.current = true;
    void markPracticeDay("quiz");
  }, [markPracticeDay, session.batchIds.length, session.stage]);

  const stageTitle = learnStageTitle(session.stage);
  const progressMeta = learnStageProgress(session, boards.length);
  const wordId = currentBatchWordId(session);
  const word = wordId ? wordById(wordId) : undefined;
  const row = wordId ? progress[wordId] : undefined;

  async function finishTypeWord(id: string, live: LearnSession) {
    if (gradeLock.current) return;
    if (graded.current.has(id)) {
      setSession(advanceTypeCorrect(live));
      return;
    }
    gradeLock.current = true;
    try {
      const rating = ratingForWord(live, id);
      await grade(id, rating);
      graded.current.add(id);
      setSession(advanceTypeCorrect(live));
    } catch {
      // Keep the child on Type if grade fails; they can retry Check.
    } finally {
      gradeLock.current = false;
    }
  }

  return (
    <Frame>
      <header className="safe-top flex items-baseline justify-between gap-3 px-5 pb-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{stageTitle}</p>
          {session.stage !== "done" ? (
            <p className="text-xs tabular-nums text-muted">
              {progressMeta.total > 0 ? `${progressMeta.current} of ${progressMeta.total}` : "—"}
              <span className="text-muted/70"> · {batchIds.length} new</span>
            </p>
          ) : null}
        </div>
        <Link to="/" className="min-h-11 shrink-0 text-sm text-muted">
          Close
        </Link>
      </header>

      <main className="flex flex-1 flex-col px-5 pb-8">
        {session.stage === "learn" && word ? (
          <LearnItStage
            key={word.id}
            wordId={word.id}
            lemma={word.lemma}
            arabic={glossFor(word.id, row?.arabic)}
            example={word.example}
            highlight={word.highlight}
            hasPicture={row?.hasPicture ?? false}
            pictureRev={row?.pictureRev ?? 0}
            onGotIt={() => setSession((prev) => advanceLearnGotIt(prev, boards.length))}
          />
        ) : null}

        {session.stage === "match" && boards.length > 0 ? (
          <MatchItStage
            key={`match-${session.boardIndex}`}
            board={boards[session.boardIndex]!}
            boardIndex={session.boardIndex}
            boardCount={boards.length}
            progress={progress}
            onBoardClear={() => setSession((prev) => advanceMatchBoard(prev, boards.length))}
          />
        ) : null}

        {session.stage === "spell" && word ? (
          <SpellItStage
            key={`spell-${word.id}`}
            wordId={word.id}
            lemma={word.lemma}
            arabic={glossFor(word.id, row?.arabic)}
            hasPicture={row?.hasPicture ?? false}
            pictureRev={row?.pictureRev ?? 0}
            onCorrect={() => setSession((prev) => advanceSpellCorrect(prev))}
            onWrong={() => setSession((prev) => noteSpellRetry(prev, word.id))}
          />
        ) : null}

        {session.stage === "type" && word ? (
          <TypeItStage
            key={`type-${word.id}`}
            wordId={word.id}
            lemma={word.lemma}
            arabic={glossFor(word.id, row?.arabic)}
            hasPicture={row?.hasPicture ?? false}
            pictureRev={row?.pictureRev ?? 0}
            onCorrect={() => {
              const id = word.id;
              setSession((prev) => {
                // Grade uses this snapshot (retries already applied on wrongs).
                void finishTypeWord(id, prev);
                return prev;
              });
            }}
            onWrong={() => setSession((prev) => noteTypeRetry(prev, word.id))}
          />
        ) : null}

        {session.stage === "done" ? (
          <LearnSessionEnd
            session={session}
            topic={topic}
            progress={progress}
            settings={settings}
          />
        ) : null}
      </main>
    </Frame>
  );
}

/** Phase 4 — teach-only card. No fail state; one action: Got it. */
function LearnItStage({
  wordId,
  lemma,
  arabic,
  example,
  highlight,
  hasPicture,
  pictureRev,
  onGotIt,
}: {
  wordId: string;
  lemma: string;
  arabic: string;
  example: string;
  highlight: string;
  hasPicture: boolean;
  pictureRev: number;
  onGotIt: () => void;
}) {
  const picture = useLocalPicture(wordId, hasPicture, pictureRev);
  const speakOk = canSpeak();

  useEffect(() => {
    speakEnglish(lemma);
  }, [lemma, wordId]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center gap-5">
        {picture ? (
          <div className="mx-auto w-full max-w-[16rem] overflow-hidden rounded-3xl border border-line bg-card shadow-sm">
            <img
              src={picture}
              alt=""
              className="aspect-square w-full object-cover"
              draggable={false}
            />
          </div>
        ) : null}

        <div className="text-center">
          <p className="font-display text-5xl tracking-tight text-balance">{lemma}</p>
          {arabic ? (
            <p className="mt-3 text-2xl leading-snug text-muted" lang="ar" dir="rtl">
              {arabic}
            </p>
          ) : null}
        </div>

        {example.trim() ? (
          <div className="rounded-2xl border border-line bg-card px-4 py-3 text-left">
            <ExampleLine example={example} highlight={highlight || lemma} />
          </div>
        ) : null}

        {speakOk ? (
          <button
            type="button"
            onClick={() => speakEnglish(lemma)}
            aria-label={`Speak ${lemma}`}
            className="mx-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-card px-5 text-sm font-medium"
          >
            <span aria-hidden="true">🔊</span>
            Speak
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onGotIt}
        className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper"
      >
        Got it
      </button>
    </div>
  );
}

type MatchTile = {
  key: string;
  wordId: string;
  side: "en" | "ar" | "pic";
  label: string;
  mode: MatchMode;
  lemma: string;
};

function tilesForBoard(pairs: MatchBoardPair[]): MatchTile[] {
  const tiles: MatchTile[] = [];
  for (const pair of pairs) {
    if (pair.mode === "picture") {
      tiles.push({
        key: `${pair.wordId}-pic`,
        wordId: pair.wordId,
        side: "pic",
        label: pair.lemma,
        mode: "picture",
        lemma: pair.lemma,
      });
      tiles.push({
        key: `${pair.wordId}-en`,
        wordId: pair.wordId,
        side: "en",
        label: pair.lemma,
        mode: "picture",
        lemma: pair.lemma,
      });
    } else {
      tiles.push({
        key: `${pair.wordId}-en`,
        wordId: pair.wordId,
        side: "en",
        label: pair.lemma,
        mode: "en-ar",
        lemma: pair.lemma,
      });
      tiles.push({
        key: `${pair.wordId}-ar`,
        wordId: pair.wordId,
        side: "ar",
        label: pair.gloss,
        mode: "en-ar",
        lemma: pair.lemma,
      });
    }
  }
  return shuffle(tiles);
}

/** Phase 5 — recognition match. No grade/introduce. Clear board → next / Spell. */
function MatchItStage({
  board,
  boardIndex,
  boardCount,
  progress,
  onBoardClear,
}: {
  board: MatchBoard;
  boardIndex: number;
  boardCount: number;
  progress: Record<string, Progress>;
  onBoardClear: () => void;
}) {
  const tiles = useMemo(() => tilesForBoard(board.pairs), [board]);
  const [up, setUp] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrongKeys, setWrongKeys] = useState<string[]>([]);
  const [shakeKey, setShakeKey] = useState<string | null>(null);
  const [sparkId, setSparkId] = useState<string | null>(null);
  const lock = useRef(false);
  const advanced = useRef(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (advanced.current) return;
    if (board.pairs.length === 0) return;
    if (matched.length < board.pairs.length) return;
    advanced.current = true;
    const timer = window.setTimeout(() => {
      onBoardClear();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [board.pairs.length, matched.length, onBoardClear]);

  function flip(key: string) {
    if (lock.current || up.length >= 2 || up.includes(key)) return;
    const tile = tiles.find((item) => item.key === key);
    if (!tile || matched.includes(tile.wordId)) return;

    const next = [...up, key];
    setUp(next);
    if (next.length < 2) return;

    lock.current = true;
    const first = tiles.find((item) => item.key === next[0]);
    const second = tile;
    const hit = Boolean(first && first.wordId === second.wordId && first.side !== second.side);

    if (hit && first) {
      playEffect("correct");
      haptics.correct();
      setSparkId(first.wordId);
      setWrongKeys([]);
      setShakeKey(null);
      window.setTimeout(() => speakEnglish(first.lemma), 450);
    } else if (first) {
      playEffect("incorrect");
      haptics.wrong();
      setWrongKeys(next);
      setSparkId(null);
      const partner = tiles.find((item) => item.wordId === first.wordId && item.key !== first.key);
      setShakeKey(partner?.key ?? null);
    }

    window.setTimeout(() => {
      if (hit && first) {
        setMatched((current) =>
          current.includes(first.wordId) ? current : [...current, first.wordId],
        );
      }
      setUp([]);
      setWrongKeys([]);
      setShakeKey(null);
      lock.current = false;
    }, 1100);
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-sm text-muted">
        Board {boardIndex + 1} of {boardCount}. Match each pair.
      </p>
      <div className="mt-4 grid flex-1 grid-cols-2 content-start gap-2">
        {tiles.map((tile, index) => {
          const open = up.includes(tile.key) || matched.includes(tile.wordId);
          const wrong = wrongKeys.includes(tile.key);
          const shake = shakeKey === tile.key;
          const isMatched = matched.includes(tile.wordId);
          const row = progress[tile.wordId];
          const animate =
            shake && !reduced
              ? {
                  opacity: 1,
                  x: [0, -6, 6, 0],
                  scale: 1,
                  transition: { duration: 0.42, times: [0, 0.25, 0.75, 1] },
                }
              : isMatched && !reduced
                ? {
                    opacity: 1,
                    x: 0,
                    scale: [1, 1.06, 1],
                    transition: { duration: 0.5, ease: EASE.standard },
                  }
                : {
                    opacity: 1,
                    x: 0,
                    scale: 1,
                    transition: { duration: 0.3, delay: Math.min(index, 8) * 0.04 },
                  };

          return (
            <m.button
              key={tile.key}
              type="button"
              data-tile=""
              onClick={() => flip(tile.key)}
              className={`relative flex min-h-20 items-center justify-center overflow-hidden rounded-2xl border px-3 text-center ${
                wrong ? "answer-wrong" : isMatched ? "border-accent bg-card" : "border-line bg-card"
              }`}
              initial={reduced ? false : { opacity: 0, scale: 0.88 }}
              animate={animate}
            >
              {sparkId === tile.wordId ? <Sparkles /> : null}
              {open ? (
                <MatchTileFace
                  tile={tile}
                  hasPicture={row?.hasPicture ?? false}
                  pictureRev={row?.pictureRev ?? 0}
                />
              ) : (
                <span className="text-sm text-muted">
                  {tile.side === "ar" ? "Arabic" : tile.side === "pic" ? "Picture" : "English"}
                </span>
              )}
            </m.button>
          );
        })}
      </div>
    </div>
  );
}

function MatchTileFace({
  tile,
  hasPicture,
  pictureRev,
}: {
  tile: MatchTile;
  hasPicture: boolean;
  pictureRev: number;
}) {
  if (tile.side === "pic") {
    return (
      <MatchPictureFace wordId={tile.wordId} hasPicture={hasPicture} pictureRev={pictureRev} />
    );
  }
  if (tile.side === "ar") {
    return (
      <span lang="ar" dir="rtl" className="font-arabic text-xl">
        {tile.label}
      </span>
    );
  }
  return <span className="font-display text-2xl">{tile.label}</span>;
}

function MatchPictureFace({
  wordId,
  hasPicture,
  pictureRev,
}: {
  wordId: string;
  hasPicture: boolean;
  pictureRev: number;
}) {
  const url = useLocalPicture(wordId, hasPicture, pictureRev);
  if (!url) {
    return <span className="text-sm text-muted">…</span>;
  }
  return (
    <img
      src={url}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
      draggable={false}
    />
  );
}

/** Rebuild the lemma string from gap cells + chosen tile letters. */
function spellGuess(puzzle: SpellPuzzle, placed: Array<number | null>): string {
  let gapIndex = 0;
  let out = "";
  for (const cell of puzzle.cells) {
    if (!cell.gap) {
      out += cell.char;
      continue;
    }
    const tileIndex = placed[gapIndex] ?? null;
    gapIndex += 1;
    if (tileIndex == null) {
      out += "";
      continue;
    }
    const letter = puzzle.tiles[tileIndex] ?? "";
    const upper =
      cell.char.length === 1 &&
      cell.char.toLowerCase() !== cell.char.toUpperCase() &&
      cell.char === cell.char.toUpperCase();
    out += upper ? letter.toUpperCase() : letter;
  }
  return out;
}

function gapSlotIndex(cells: SpellPuzzle["cells"], cellIndex: number): number {
  let slot = 0;
  for (let i = 0; i < cellIndex; i += 1) {
    if (cells[i]?.gap) slot += 1;
  }
  return slot;
}

function displayGapLetter(cellChar: string, letter: string): string {
  if (!letter) return "";
  const upper =
    cellChar.length === 1 &&
    cellChar.toLowerCase() !== cellChar.toUpperCase() &&
    cellChar === cellChar.toUpperCase();
  return upper ? letter.toUpperCase() : letter;
}

/** Phase 6 — tiles + gaps. Wrong → diff + reveal + speak + retry. No skip. */
function SpellItStage({
  wordId,
  lemma,
  arabic,
  hasPicture,
  pictureRev,
  onCorrect,
  onWrong,
}: {
  wordId: string;
  lemma: string;
  arabic: string;
  hasPicture: boolean;
  pictureRev: number;
  onCorrect: () => void;
  onWrong: () => void;
}) {
  const picture = useLocalPicture(wordId, hasPicture, pictureRev);
  // Local reshuffle only — do not tie puzzle salt to session retries, or the
  // wrong-state UI would unmount the moment onWrong bumps the counter.
  const [reshuffle, setReshuffle] = useState(0);
  const puzzle = useMemo(
    () => spellPuzzle(lemma, reshuffle * 31 + wordId.length * 17 + 7),
    [lemma, reshuffle, wordId],
  );

  // placed[i] = index into puzzle.tiles used for gap i (null = empty).
  const [placed, setPlaced] = useState<Array<number | null>>(() => puzzle.answers.map(() => null));
  const [phase, setPhase] = useState<"play" | "wrong">("play");
  const [diff, setDiff] = useState<SpellDiffCell[] | null>(null);
  const lock = useRef(false);

  // Reset slots when tiles reshuffle (Try again) — keep wrong UI until then.
  useEffect(() => {
    setPlaced(puzzle.answers.map(() => null));
    lock.current = false;
  }, [puzzle]);

  const filledCount = placed.filter((slot) => slot != null).length;
  const allFilled = puzzle.answers.length === 0 || filledCount >= puzzle.answers.length;
  const usedTiles = new Set(placed.filter((slot): slot is number => slot != null));

  function pickTile(tileIndex: number) {
    if (phase !== "play" || lock.current) return;
    if (usedTiles.has(tileIndex)) return;
    const emptyAt = placed.findIndex((slot) => slot == null);
    if (emptyAt === -1) return;
    setPlaced((current) => {
      const next = current.slice();
      next[emptyAt] = tileIndex;
      return next;
    });
  }

  function undoLast() {
    if (phase !== "play" || lock.current) return;
    setPlaced((current) => {
      let last = -1;
      for (let i = 0; i < current.length; i += 1) {
        if (current[i] != null) last = i;
      }
      if (last < 0) return current;
      const next = current.slice();
      next[last] = null;
      return next;
    });
  }

  function clearAll() {
    if (phase !== "play" || lock.current) return;
    setPlaced(puzzle.answers.map(() => null));
  }

  function check() {
    if (phase !== "play" || lock.current) return;
    if (puzzle.answers.length > 0 && !allFilled) return;

    const guess = spellGuess(puzzle, placed);
    if (typeCheck(lemma, guess)) {
      lock.current = true;
      playEffect("correct");
      haptics.correct();
      window.setTimeout(() => speakEnglish(lemma), 350);
      window.setTimeout(() => onCorrect(), 700);
      return;
    }

    lock.current = true;
    playEffect("incorrect");
    haptics.wrong();
    setDiff(spellDiff(lemma, guess));
    setPhase("wrong");
    onWrong();
    speakEnglish(lemma);
  }

  function tryAgain() {
    lock.current = false;
    setDiff(null);
    setPhase("play");
    setReshuffle((value) => value + 1);
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-sm text-muted">Fill the gaps with letter tiles.</p>

      <div className="mt-4 flex flex-1 flex-col gap-5">
        {picture ? (
          <div className="mx-auto w-full max-w-[12rem] overflow-hidden rounded-3xl border border-line bg-card shadow-sm">
            <img
              src={picture}
              alt=""
              className="aspect-square w-full object-cover"
              draggable={false}
            />
          </div>
        ) : null}

        {arabic ? (
          <p className="text-center text-3xl leading-snug text-ink" lang="ar" dir="rtl">
            {arabic}
          </p>
        ) : (
          <p className="text-center text-sm text-muted">Arabic gloss missing for this card.</p>
        )}

        {/* Gap scaffold */}
        <div className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Spelling">
          {puzzle.cells.map((cell, index) => {
            if (!cell.gap) {
              return (
                <span
                  key={`c-${index}`}
                  className="inline-flex min-h-11 min-w-9 items-center justify-center px-1 font-display text-3xl"
                >
                  {cell.char === " " ? "\u00a0" : cell.char}
                </span>
              );
            }
            const slot = gapSlotIndex(puzzle.cells, index);
            const tileIndex = placed[slot] ?? null;
            const letter =
              tileIndex != null ? displayGapLetter(cell.char, puzzle.tiles[tileIndex] ?? "") : "";
            return (
              <button
                key={`g-${index}`}
                type="button"
                disabled={phase !== "play" || tileIndex == null}
                onClick={() => {
                  if (phase !== "play" || lock.current || tileIndex == null) return;
                  setPlaced((current) => {
                    const next = current.slice();
                    next[slot] = null;
                    return next;
                  });
                }}
                className={`inline-flex min-h-11 min-w-9 items-center justify-center rounded-xl border-b-2 px-1 font-display text-3xl ${
                  letter ? "border-accent text-ink" : "border-line text-muted"
                }`}
                aria-label={letter ? `Remove ${letter}` : "Empty gap"}
              >
                {letter || "·"}
              </button>
            );
          })}
        </div>

        {phase === "wrong" && diff ? (
          <div className="rounded-2xl border border-line bg-card px-4 py-3">
            <p className="text-center text-sm text-muted">Not quite — here is the word:</p>
            <p className="mt-2 text-center font-display text-3xl tracking-tight">{lemma}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1" aria-label="Letter check">
              {diff.map((cell, index) => (
                <span
                  key={index}
                  className={`inline-flex min-h-9 min-w-8 items-center justify-center rounded-lg px-1 font-display text-xl ${
                    cell.mark === "match" ? "bg-accent/15 text-accent" : "bg-danger/10 text-danger"
                  }`}
                >
                  {cell.got ?? cell.expected ?? "·"}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {phase === "play" ? (
          <>
            <div className="flex flex-wrap justify-center gap-2">
              {puzzle.tiles.map((letter, index) => {
                const used = usedTiles.has(index);
                return (
                  <button
                    key={`t-${index}-${letter}`}
                    type="button"
                    disabled={used || lock.current}
                    onClick={() => pickTile(index)}
                    className={`inline-flex min-h-12 min-w-11 items-center justify-center rounded-2xl border px-3 font-display text-2xl ${
                      used
                        ? "border-transparent bg-transparent text-transparent"
                        : "border-line bg-card"
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={undoLast}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-line px-4 text-sm font-medium"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-line px-4 text-sm font-medium"
              >
                Clear
              </button>
            </div>
          </>
        ) : null}
      </div>

      {phase === "play" ? (
        <button
          type="button"
          disabled={!allFilled || lock.current}
          onClick={check}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper disabled:opacity-40"
        >
          Check
        </button>
      ) : (
        <button
          type="button"
          onClick={tryAgain}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Phase 7 — full a–z keyboard. Wrong → diff + reveal + speak + retry. No skip. */
function TypeItStage({
  wordId,
  lemma,
  arabic,
  hasPicture,
  pictureRev,
  onCorrect,
  onWrong,
}: {
  wordId: string;
  lemma: string;
  arabic: string;
  hasPicture: boolean;
  pictureRev: number;
  onCorrect: () => void;
  onWrong: () => void;
}) {
  const picture = useLocalPicture(wordId, hasPicture, pictureRev);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"play" | "wrong">("play");
  const [diff, setDiff] = useState<SpellDiffCell[] | null>(null);
  const lock = useRef(false);

  function pressLetter(ch: string) {
    if (phase !== "play" || lock.current) return;
    setTyped((current) => current + ch);
  }

  function pressSpace() {
    if (phase !== "play" || lock.current) return;
    setTyped((current) => (current.endsWith(" ") ? current : `${current} `));
  }

  function pressBackspace() {
    if (phase !== "play" || lock.current) return;
    setTyped((current) => current.slice(0, -1));
  }

  function check() {
    if (phase !== "play" || lock.current) return;
    if (!typed.trim()) return;

    if (typeCheck(lemma, typed)) {
      lock.current = true;
      playEffect("correct");
      haptics.correct();
      window.setTimeout(() => speakEnglish(lemma), 350);
      window.setTimeout(() => onCorrect(), 700);
      return;
    }

    lock.current = true;
    playEffect("incorrect");
    haptics.wrong();
    setDiff(spellDiff(lemma, typed));
    setPhase("wrong");
    onWrong();
    speakEnglish(lemma);
  }

  function tryAgain() {
    lock.current = false;
    setDiff(null);
    setTyped("");
    setPhase("play");
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-sm text-muted">Type the English word.</p>

      <div className="mt-4 flex flex-1 flex-col gap-4">
        {picture ? (
          <div className="mx-auto w-full max-w-[12rem] overflow-hidden rounded-3xl border border-line bg-card shadow-sm">
            <img
              src={picture}
              alt=""
              className="aspect-square w-full object-cover"
              draggable={false}
            />
          </div>
        ) : null}

        {arabic ? (
          <p className="text-center text-3xl leading-snug text-ink" lang="ar" dir="rtl">
            {arabic}
          </p>
        ) : (
          <p className="text-center text-sm text-muted">Arabic gloss missing for this card.</p>
        )}

        <div
          className="min-h-14 rounded-2xl border border-line bg-card px-4 py-3 text-center font-display text-3xl tracking-tight"
          aria-live="polite"
        >
          {typed || <span className="text-muted">…</span>}
        </div>

        {phase === "wrong" && diff ? (
          <div className="rounded-2xl border border-line bg-card px-4 py-3">
            <p className="text-center text-sm text-muted">Not quite — here is the word:</p>
            <p className="mt-2 text-center font-display text-3xl tracking-tight">{lemma}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1" aria-label="Letter check">
              {diff.map((cell, index) => (
                <span
                  key={index}
                  className={`inline-flex min-h-9 min-w-8 items-center justify-center rounded-lg px-1 font-display text-xl ${
                    cell.mark === "match" ? "bg-accent/15 text-accent" : "bg-danger/10 text-danger"
                  }`}
                >
                  {cell.got ?? cell.expected ?? "·"}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {phase === "play" ? (
          <div className="mt-auto space-y-2">
            <div className="grid grid-cols-9 gap-1.5">
              {TYPE_KEYS.slice(0, 9).map((ch) => (
                <TypeKey key={ch} label={ch} onPress={() => pressLetter(ch)} />
              ))}
            </div>
            <div className="grid grid-cols-9 gap-1.5">
              {TYPE_KEYS.slice(9, 18).map((ch) => (
                <TypeKey key={ch} label={ch} onPress={() => pressLetter(ch)} />
              ))}
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {TYPE_KEYS.slice(18).map((ch) => (
                <TypeKey key={ch} label={ch} onPress={() => pressLetter(ch)} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={pressSpace}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-card text-sm font-medium"
              >
                Space
              </button>
              <button
                type="button"
                onClick={pressBackspace}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-card text-sm font-medium"
              >
                ⌫
              </button>
              <button
                type="button"
                onClick={() => setTyped("")}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-card text-sm font-medium"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {phase === "play" ? (
        <button
          type="button"
          disabled={!typed.trim() || lock.current}
          onClick={check}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper disabled:opacity-40"
        >
          Check
        </button>
      ) : (
        <button
          type="button"
          onClick={tryAgain}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function TypeKey({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-card font-display text-lg uppercase"
    >
      {label}
    </button>
  );
}

/** Phase 8 — score end after introduce. Quit mid-session never reaches here. */
function LearnSessionEnd({
  session,
  topic,
  progress,
  settings,
}: {
  session: LearnSession;
  topic?: string;
  progress: Record<string, Progress>;
  settings: { newCap: number };
}) {
  const tally = useMemo(() => learnTally(session), [session]);
  const newLeft = useMemo(
    () => learningBatch(progress, settings, Date.now(), learnLookup, topic).length,
    [progress, settings, topic],
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-center text-sm text-muted">Learn complete</p>
        <h1 className="mt-2 text-center font-display text-4xl tracking-tight text-balance">
          {session.batchIds.length} new {session.batchIds.length === 1 ? "word" : "words"}
        </h1>
        <ScoreReport tally={tally} />
        <p className="mt-3 text-center text-sm text-muted">
          Clean Spell + Type counts as right. Retries still introduce the word.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          to="/"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper"
        >
          Back to today
        </Link>
        <Link
          to="/review"
          search={{
            mode: "practice",
            words: session.batchIds,
            ...(topic ? { topic } : {}),
          }}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-line px-5 text-base font-medium"
        >
          Practice again
        </Link>
        <Link
          to="/play"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-line px-5 text-base font-medium"
        >
          Play
        </Link>
        {newLeft > 0 ? (
          <Link
            to="/learn"
            search={topic ? { topic } : {}}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-line px-5 text-base font-medium"
          >
            Learn again
          </Link>
        ) : null}
      </div>
    </div>
  );
}
