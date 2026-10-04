import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { distinctWords, gamePoolSize, misalign, nextSeen, shuffle, type PlayWord } from "@/lib/cards/groups";
import { usePracticeClock } from "@/lib/cards/clock";
import { playEffect, playFinish } from "@/lib/cards/sounds";
import { speakEnglish } from "@/lib/cards/speech";
import { useVault } from "@/lib/cards/store";
import { EMPTY_TALLY, ScoreReport, Sparkles, addTap, type Tally } from "@/components/score-report";
import { GameFrame } from "./letters";

export function ConnectGame({ topic }: { topic?: string }) {
  const grade = useVault((state) => state.grade);
  const markPracticeDay = useVault((state) => state.markPracticeDay);
  const [round, setRound] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);
  const words = useMemo(() => {
    const progress = useVault.getState().progress;
    return shuffle(distinctWords(progress, topic, 5, seen));
  }, [round, seen, topic]);
  const arabic = useMemo(
    () => misalign(words, (left, right) => left.id === right.id),
    [words],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<string[]>([]);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [badEnglish, setBadEnglish] = useState<string | null>(null);
  const [badArabic, setBadArabic] = useState<string | null>(null);
  const [sparkId, setSparkId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tally, setTally] = useState<Tally>(EMPTY_TALLY);
  const playedEnd = useRef(false);
  usePracticeClock(words.length > 0 && !saved);

  const done = words.length >= 3 && Object.keys(links).length === words.length;

  useEffect(() => {
    if (!done) {
      playedEnd.current = false;
      return;
    }
    void markPracticeDay("game");
    if (playedEnd.current) return;
    playedEnd.current = true;
    if (tally.attempts < 1) return;
    playFinish(tally.correct === tally.attempts);
  }, [done, markPracticeDay, tally.attempts, tally.correct]);

  async function finish(list: PlayWord[], wrong: string[]) {
    if (saved) return;
    setSaved(true);
    const missed = new Set(wrong);
    for (const word of list) {
      await grade(word.id, missed.has(word.id) ? "again" : "good", true);
    }
  }

  if (words.length < 3) {
    return (
      <GameFrame title="Connect" topic={topic}>
        <p className="font-display text-4xl tracking-tight text-balance">Need three different meanings.</p>
        <p className="mt-3 text-pretty text-muted">Add a few more words, then connect them to the Arabic.</p>
        <Link to="/words" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 font-medium text-paper">
          Add words
        </Link>
      </GameFrame>
    );
  }

  if (done) {
    return (
      <GameFrame title="Connect" topic={topic}>
        <h1 className="font-display text-5xl tracking-tight">Joined.</h1>
        <ScoreReport tally={tally} />
        <p className="mt-3 text-pretty text-muted">
          {dirty.length === 0
            ? "Every line was right."
            : "A wrong join brings that card back. A clean join does not hide the word until tomorrow."}
        </p>
        <button
          type="button"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 font-medium text-paper"
          onClick={() => {
            const progress = useVault.getState().progress;
            setSeen((current) => nextSeen(current, words.map((word) => word.id), gamePoolSize(progress, topic)));
            setRound((value) => value + 1);
            setPicked(null);
            setLinks({});
            setDirty([]);
            setSaved(false);
            setTally(EMPTY_TALLY);
            setShakeId(null);
            setBadEnglish(null);
            setBadArabic(null);
            setSparkId(null);
          }}
        >
          Another round
        </button>
      </GameFrame>
    );
  }

  function chooseEnglish(id: string) {
    if (links[id]) return;
    setPicked(id);
    setShakeId(null);
    setBadEnglish(null);
    setBadArabic(null);
  }

  function chooseArabic(word: PlayWord) {
    if (!picked || links[picked] || Object.values(links).includes(word.id)) return;
    const right = picked === word.id;
    setTally((current) => addTap(current, right));
    if (right) {
      const next = { ...links, [picked]: word.id };
      setLinks(next);
      setPicked(null);
      setShakeId(null);
      setBadEnglish(null);
      setBadArabic(null);
      setSparkId(word.id);
      playEffect("correct");
      window.setTimeout(() => speakEnglish(word.lemma), 450);
      if (Object.keys(next).length === words.length) void finish(words, dirty);
      return;
    }
    setDirty((current) => [...current, picked, word.id]);
    setBadEnglish(picked);
    setBadArabic(word.id);
    setSparkId(null);
    setShakeId(null);
    playEffect("incorrect");
    window.setTimeout(() => setShakeId(picked), 30);
  }

  return (
    <GameFrame title="Connect" topic={topic}>
      <p className="text-sm text-muted">Tap an English word, then the Arabic that means it.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <ul className="flex flex-col gap-2">
          {words.map((word) => {
            const linked = Boolean(links[word.id]);
            const active = picked === word.id;
            const wrong = badEnglish === word.id;
            return (
              <li key={word.id}>
                <button
                  type="button"
                  disabled={linked}
                  onClick={() => chooseEnglish(word.id)}
                  className={`relative flex min-h-14 w-full items-center justify-center rounded-2xl border px-2 text-center font-display text-xl ${
                    wrong ? "answer-wrong" : linked ? "border-accent bg-card text-muted" : active ? "border-accent bg-accent text-paper" : "border-line bg-card"
                  }`}
                >
                  {sparkId === word.id ? <Sparkles /> : null}
                  {word.lemma}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="flex flex-col gap-2">
          {arabic.map((word) => {
            const used = Object.values(links).includes(word.id);
            const wrong = badArabic === word.id;
            const shake = shakeId === word.id;
            return (
              <li key={word.id}>
                <button
                  type="button"
                  disabled={used || !picked}
                  lang="ar"
                  dir="rtl"
                  onClick={() => chooseArabic(word)}
                  className={`font-arabic relative flex min-h-14 w-full items-center justify-center rounded-2xl border px-2 text-center text-xl ${
                    wrong ? "answer-wrong" : used ? "border-accent bg-card text-muted" : "border-line bg-card"
                  } ${shake ? "shake" : ""}`}
                >
                  {sparkId === word.id ? <Sparkles /> : null}
                  {word.gloss}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {badArabic ? <p className="mt-4 text-sm text-muted">Not that pair. The right one shakes.</p> : null}
    </GameFrame>
  );
}
