import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Frame } from "@/components/chrome";
import { useLocalPicture } from "@/components/use-picture";
import { gamePoolSize, letterRound, nextSeen, shuffle } from "@/lib/cards/groups";
import { usePracticeClock } from "@/lib/cards/clock";
import { playEffect, playFinish } from "@/lib/cards/sounds";
import { speakEnglish } from "@/lib/cards/speech";
import { useVault } from "@/lib/cards/store";
import { haptics } from "@/lib/motion/haptics";
import { EASE } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import { m } from "motion/react";
import { EMPTY_TALLY, ScoreReport, Sparkles, addTap, type Tally } from "@/components/score-report";
import type { GradeName } from "@/lib/cards/types";

const BANK = "abcdefghijklmnopqrstuvwxyz";

export function LettersGame({ topic }: { topic?: string }) {
  const grade = useVault((state) => state.grade);
  const markPracticeDay = useVault((state) => state.markPracticeDay);
  const [round, setRound] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [helped, setHelped] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [tally, setTally] = useState<Tally>(EMPTY_TALLY);
  const lock = useRef(false);
  const playedEnd = useRef(false);
  const reduced = useReducedMotion();

  const pack = useMemo(
    () => letterRound(useVault.getState().progress, topic, seen),
    [round, seen, topic],
  );
  const card = pack[cursor];
  usePracticeClock(card != null);
  const finished = pack.length > 0 && !card;
  useEffect(() => {
    if (!finished) {
      playedEnd.current = false;
      return;
    }
    void markPracticeDay("game");
    if (playedEnd.current) return;
    playedEnd.current = true;
    if (tally.attempts < 1) return;
    playFinish(tally.correct === tally.attempts);
  }, [finished, markPracticeDay, tally.attempts, tally.correct]);
  const picture = useLocalPicture(
    card?.id ?? null,
    card?.hasPicture ?? false,
    card?.pictureRev ?? 0,
  );

  const choices = useMemo(() => {
    if (!card) return [];
    const letter = card.lemma[card.index]?.toLowerCase() ?? "";
    const pool = shuffle(BANK.split("").filter((item) => item !== letter));
    return shuffle([letter, ...pool.slice(0, 5)]);
  }, [card, round]);

  if (pack.length === 0) {
    return (
      <GameFrame title="Missing letter" topic={topic}>
        <p className="font-display text-4xl tracking-tight text-balance">
          Not enough words for this one.
        </p>
        <p className="mt-3 text-pretty text-muted">
          It needs words of at least three letters. Match and Connect work with short words too.
        </p>
        <Link
          to="/play"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 font-medium text-paper"
        >
          Other games
        </Link>
      </GameFrame>
    );
  }

  if (!card) {
    return (
      <GameFrame title="Missing letter" topic={topic}>
        <p className="text-sm tabular-nums text-muted">{pack.length} words</p>
        <h1 className="mt-2 font-display text-5xl tracking-tight">Round done.</h1>
        <ScoreReport tally={tally} />
        <p className="mt-3 text-pretty text-muted">
          You can play it again now. A miss comes back into the cards. A right answer does not push
          a word further away.
        </p>
        <button
          type="button"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 font-medium text-paper"
          onClick={() => {
            const progress = useVault.getState().progress;
            setSeen((current) =>
              nextSeen(
                current,
                pack.map((word) => word.id),
                gamePoolSize(progress, topic, true),
              ),
            );
            setRound((value) => value + 1);
            setCursor(0);
            setPicked(null);
            setHelped(false);
            setTally(EMPTY_TALLY);
          }}
        >
          Another round
        </button>
      </GameFrame>
    );
  }

  const answer = card.lemma[card.index]?.toLowerCase() ?? "";
  const right = picked === answer;
  const chars = [...card.lemma];

  async function choose(letter: string) {
    if (lock.current || picked) return;
    lock.current = true;
    setPicked(letter);
    const right = letter === answer;
    setTally((current) => addTap(current, right));
    playEffect(right ? "correct" : "incorrect");
    if (right) haptics.correct();
    else haptics.wrong();
    window.setTimeout(() => speakEnglish(card.lemma), 450);
    const rating: GradeName = letter !== answer ? "again" : helped ? "hard" : "good";
    try {
      await grade(card.id, rating, true);
    } finally {
      lock.current = false;
    }
    if (letter === answer) {
      window.setTimeout(() => {
        setPicked(null);
        setHelped(false);
        setCursor((value) => value + 1);
      }, 1200);
    }
  }

  function next() {
    setPicked(null);
    setHelped(false);
    setCursor((value) => value + 1);
  }

  return (
    <GameFrame title="Missing letter" topic={topic}>
      <p className="text-sm tabular-nums text-muted">
        {cursor + 1} of {pack.length}
      </p>
      {picture ? (
        <div className="mt-4 flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl bg-paper">
          <img src={picture} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}
      <p
        className="mt-6 font-display text-5xl leading-none tracking-tight"
        aria-label={picked ? card.lemma : "Word with a missing letter"}
      >
        {chars.map((char, index) =>
          index === card.index ? (
            <span
              key={index}
              className="mx-0.5 inline-block min-w-8 border-b-2 border-accent text-center text-accent"
            >
              {picked ? answer : "\u00a0"}
            </span>
          ) : (
            <span key={index}>{char}</span>
          ),
        )}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {picked
            ? right
              ? "That's the letter."
              : "Not that letter."
            : "Which letter is missing?"}
        </p>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full border border-line"
          aria-label={`Hear ${card.lemma}`}
          onClick={() => {
            setHelped(true);
            speakEnglish(card.lemma);
          }}
        >
          <img src="/ui/speak.png" alt="" className="size-7 object-contain" />
        </button>
      </div>
      {picked ? (
        <p lang="ar" dir="rtl" className="reveal mt-4 font-arabic text-right text-2xl">
          {card.gloss}
        </p>
      ) : null}
      <div className="mt-6 grid grid-cols-3 gap-2">
        {choices.map((letter, index) => {
          const correct = picked && letter === answer;
          const wrongPick = picked === letter && !right;
          const revealShake = picked && !right && letter === answer;
          const animate =
            revealShake && !reduced
              ? {
                  opacity: 1,
                  x: [0, -6, 6, 0],
                  scale: 1,
                  transition: { duration: 0.42, times: [0, 0.25, 0.75, 1] },
                }
              : correct && !reduced
                ? {
                    opacity: 1,
                    x: 0,
                    scale: [1, 1.08, 1],
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
              key={letter}
              type="button"
              data-tile=""
              disabled={picked != null}
              onClick={() => void choose(letter)}
              className={`relative min-h-14 rounded-2xl border text-xl font-medium uppercase ${
                correct
                  ? "border-accent bg-accent text-paper"
                  : wrongPick
                    ? "answer-wrong"
                    : "border-line bg-card"
              }`}
              initial={reduced ? false : { opacity: 0, scale: 0.88 }}
              animate={animate}
            >
              {picked && right && letter === answer ? <Sparkles /> : null}
              {letter}
            </m.button>
          );
        })}
      </div>
      {picked && !right ? (
        <button
          type="button"
          onClick={next}
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 font-medium text-paper"
        >
          Next word
        </button>
      ) : null}
    </GameFrame>
  );
}

export function GameFrame({
  title,
  topic,
  children,
}: {
  title: string;
  topic?: string;
  children: ReactNode;
}) {
  return (
    <Frame>
      <header className="safe-top px-5 pb-2">
        <Link
          to="/play"
          search={topic ? { topic } : {}}
          className="inline-flex min-h-11 items-center text-sm text-muted"
        >
          Games
        </Link>
        <h1 className="font-display text-4xl tracking-tight">{title}</h1>
      </header>
      <main className="flex flex-1 flex-col px-5 pb-8">{children}</main>
    </Frame>
  );
}
