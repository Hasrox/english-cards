import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { distinctWords, gamePoolSize, nextSeen, shuffle, type PlayWord } from "@/lib/cards/groups";
import { usePracticeClock } from "@/lib/cards/clock";
import { playEffect, playFinish } from "@/lib/cards/sounds";
import { speakEnglish } from "@/lib/cards/speech";
import { useVault } from "@/lib/cards/store";
import { EMPTY_TALLY, ScoreReport, Sparkles, addTap, type Tally } from "@/components/score-report";
import { GameFrame } from "./letters";

type Tile = { key: string; wordId: string; side: "en" | "ar"; label: string };

function tilesFor(words: PlayWord[]): Tile[] {
  const tiles: Tile[] = [];
  for (const word of words) {
    tiles.push({ key: `${word.id}-en`, wordId: word.id, side: "en", label: word.lemma });
    tiles.push({ key: `${word.id}-ar`, wordId: word.id, side: "ar", label: word.gloss });
  }
  return shuffle(tiles);
}

export function MatchGame({ topic }: { topic?: string }) {
  const grade = useVault((state) => state.grade);
  const markPracticeDay = useVault((state) => state.markPracticeDay);
  const [round, setRound] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);
  const words = useMemo(() => distinctWords(useVault.getState().progress, topic, 4, seen), [round, seen, topic]);
  const tiles = useMemo(() => tilesFor(words), [words]);
  const [up, setUp] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [dirty, setDirty] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [tally, setTally] = useState<Tally>(EMPTY_TALLY);
  const [wrongKeys, setWrongKeys] = useState<string[]>([]);
  const [shakeKey, setShakeKey] = useState<string | null>(null);
  const [sparkId, setSparkId] = useState<string | null>(null);
  usePracticeClock(words.length > 0 && !saved);
  const lock = useRef(false);
  const playedEnd = useRef(false);

  const saving = useRef(false);

  useEffect(() => {
    if (!saved) {
      playedEnd.current = false;
      return;
    }
    void markPracticeDay("game");
    if (playedEnd.current) return;
    playedEnd.current = true;
    if (tally.attempts < 1) return;
    playFinish(tally.correct === tally.attempts);
  }, [markPracticeDay, saved, tally.attempts, tally.correct]);

  useEffect(() => {
    if (saving.current || words.length < 4 || matched.length !== words.length) return;
    saving.current = true;
    setSaved(true);
    const wrong = new Set(dirty);
    void (async () => {
      for (const word of words) {
        await grade(word.id, wrong.has(word.id) ? "again" : "good", true);
      }
    })();
  }, [dirty, grade, matched.length, words]);

  if (words.length < 4) {
    return (
      <GameFrame title="Match" topic={topic}>
        <p className="font-display text-4xl tracking-tight text-balance">Need four different meanings.</p>
        <p className="mt-3 text-pretty text-muted">Add a few more words, or pick another group on the island.</p>
        <Link to="/words" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 font-medium text-paper">
          Add words
        </Link>
      </GameFrame>
    );
  }

  if (saved) {
    const misses = new Set(dirty).size;
    return (
      <GameFrame title="Match" topic={topic}>
        <h1 className="font-display text-5xl tracking-tight">Paired.</h1>
        <ScoreReport tally={tally} />
        <p className="mt-3 text-pretty text-muted">
          {misses === 0 ? "Every pair was right the first time." : "A wrong flip brings that card back. A clean pair does not push it further away."}
        </p>
        <button
          type="button"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 font-medium text-paper"
          onClick={() => {
            const progress = useVault.getState().progress;
            setSeen((current) => nextSeen(current, words.map((word) => word.id), gamePoolSize(progress, topic)));
            lock.current = false;
            saving.current = false;
            setRound((value) => value + 1);
            setUp([]);
            setMatched([]);
            setDirty([]);
            setSaved(false);
            setTally(EMPTY_TALLY);
            setWrongKeys([]);
            setShakeKey(null);
            setSparkId(null);
          }}
        >
          Another round
        </button>
      </GameFrame>
    );
  }

  function flip(key: string) {
    if (lock.current || up.length >= 2 || up.includes(key)) return;
    const tile = tiles.find((item) => item.key === key);
    if (!tile || matched.includes(tile.wordId)) return;
    const next = [...up, key];
    setUp(next);
    if (next.length < 2) return;
    const first = tiles.find((item) => item.key === next[0]);
    const second = tile;
    const hit = Boolean(first && first.wordId === second.wordId && first.side !== second.side);
    setTally((current) => addTap(current, hit));
    if (hit && first) {
      playEffect("correct");
      setSparkId(first.wordId);
      setWrongKeys([]);
      setShakeKey(null);
      const word = words.find((item) => item.id === first.wordId);
      if (word) window.setTimeout(() => speakEnglish(word.lemma), 450);
    } else if (first) {
      playEffect("incorrect");
      setWrongKeys(next);
      setSparkId(null);
      const partner = tiles.find((item) => item.wordId === first.wordId && item.key !== first.key);
      setShakeKey(partner?.key ?? null);
      setDirty((current) => [...current, first.wordId, second.wordId]);
    }
    window.setTimeout(() => {
      if (hit && first) {
        setMatched((current) => (current.includes(first.wordId) ? current : [...current, first.wordId]));
      }
      setUp([]);
      setWrongKeys([]);
      setShakeKey(null);
    }, 1100);
  }

  return (
    <GameFrame title="Match" topic={topic}>
      <p className="text-sm text-muted">Flip an English word and its Arabic. Wrong flips count as a miss.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {tiles.map((tile) => {
          const open = up.includes(tile.key) || matched.includes(tile.wordId);
          const wrong = wrongKeys.includes(tile.key);
          const shake = shakeKey === tile.key;
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => flip(tile.key)}
              className={`relative flex min-h-20 items-center justify-center rounded-2xl border px-3 text-center ${
                wrong ? "answer-wrong" : matched.includes(tile.wordId) ? "border-accent bg-card" : "border-line bg-card"
              } ${shake ? "shake" : ""}`}
            >
              {sparkId === tile.wordId ? <Sparkles /> : null}
              {open ? (
                <span lang={tile.side === "ar" ? "ar" : "en"} dir={tile.side === "ar" ? "rtl" : "ltr"} className={tile.side === "ar" ? "font-arabic text-xl" : "font-display text-2xl"}>
                  {tile.label}
                </span>
              ) : (
                <span className="text-sm text-muted">{tile.side === "ar" ? "Arabic" : "English"}</span>
              )}
            </button>
          );
        })}
      </div>
    </GameFrame>
  );
}
