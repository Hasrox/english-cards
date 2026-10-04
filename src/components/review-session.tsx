import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { wordById } from "@/data/words";
import { practiceRound, quizChoices } from "@/lib/cards/groups";
import { advance, createSession, gradeSession, queueAhead, type Session } from "@/lib/cards/session";
import { speakEnglish } from "@/lib/cards/speech";
import { playEffect, playFinish } from "@/lib/cards/sounds";
import { usePracticeClock } from "@/lib/cards/clock";
import { dueIds, freshIds } from "@/lib/cards/stats";
import { useVault } from "@/lib/cards/store";
import type { GradeName } from "@/lib/cards/types";
import { Frame } from "./chrome";
import { ExampleLine } from "./example-line";
import { EMPTY_TALLY, ScoreReport, Sparkles, addTap, type Tally } from "./score-report";
import { useLocalPicture } from "./use-picture";

export function ReviewSession({
  mode,
  topic,
  round,
  onAgain,
}: {
  mode: "scheduled" | "practice";
  topic?: string;
  round: number;
  onAgain: () => void;
}) {
  const progress = useVault((state) => state.progress);
  const library = useVault((state) => state.library);
  const own = useVault((state) => state.own);
  const settings = useVault((state) => state.settings);
  const grade = useVault((state) => state.grade);
  const markPracticeDay = useVault((state) => state.markPracticeDay);
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [picked, setPicked] = useState<string | null>(null);
  const [tally, setTally] = useState<Tally>(EMPTY_TALLY);
  const lock = useRef(false);
  const wait = useRef<number | null>(null);
  const tallyRef = useRef(tally);
  const playedEnd = useRef(false);
  const gateStarted = useRef(false);
  const [open, setOpen] = useState(false);
  const [beat, setBeat] = useState<"ready" | "3" | "2" | "1" | "go" | null>(null);
  tallyRef.current = tally;
  const hasSession = session != null;
  usePracticeClock(open && session != null && session.phase !== "done");

  useEffect(() => {
    if (!hasSession || gateStarted.current) return;
    if (session?.phase === "done") {
      gateStarted.current = true;
      setOpen(true);
      return;
    }
    gateStarted.current = true;
    let cancel = false;
    let counted = false;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(() => {
        if (!cancel) fn();
      }, ms));
    };
    const countdown = new Audio("/sounds/3-sec-countdown.mp3");
    const ready = new Audio("/sounds/get-ready-for-the-next-battle.mp3");
    const beginCount = () => {
      if (cancel || counted) return;
      counted = true;
      void countdown.play().catch(() => undefined);
      setBeat("3");
      later(1000, () => setBeat("2"));
      later(2000, () => setBeat("1"));
      later(4000, () => {
        setBeat("go");
        setOpen(true);
        setSession((current) => (current ? { ...current, startedAt: Date.now() } : current));
      });
      later(700 + 4000, () => setBeat(null));
    };
    setBeat("ready");
    void ready.play().catch(() => undefined);
    ready.addEventListener("ended", beginCount, { once: true });
    later(4800, beginCount);
    return () => {
      cancel = true;
      ready.pause();
      countdown.pause();
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [hasSession, session?.phase]);

  useEffect(() => {
    if (session?.phase !== "done" || playedEnd.current) return;
    playedEnd.current = true;
    const score = tallyRef.current;
    if (score.attempts < 1) return;
    playFinish(score.correct === score.attempts);
  }, [session?.phase]);

  useEffect(() => {
    if (session?.phase === "done") void markPracticeDay("quiz");
  }, [markPracticeDay, session?.phase]);

  useEffect(() => {
    const now = Date.now();
    setSession(
      createSession({
        now,
        limitMs: mode === "practice" ? 3 * 60 * 60_000 : settings.minutes * 60_000,
        dueIds: mode === "practice" ? practiceRound(progress, topic, now, 16, round) : dueIds(progress, now),
        freshIds: mode === "practice" ? [] : freshIds(progress, settings, now),
      }),
    );
    // Queue is fixed when the session opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSession((current) => {
      if (!current || current.phase !== "hold") return current;
      return advance(current, Date.now());
    });
  }, [now]);

  const currentId = session?.current ?? null;
  const row = currentId ? progress[currentId] : undefined;
  const word = currentId ? wordById(currentId) : undefined;
  const picture = useLocalPicture(word?.id ?? null, row?.hasPicture ?? false, row?.pictureRev ?? 0);
  const choices = useMemo(() => {
    if (!word) return [];
    return quizChoices(word, own.length ? library.concat(own) : library, choiceSalt(word.id, row?.failCount ?? 0));
  }, [word, library, own, row?.failCount]);

  useEffect(() => {
    setPicked(null);
  }, [currentId]);

  useEffect(() => {
    return () => {
      if (wait.current) window.clearTimeout(wait.current);
    };
  }, []);

  async function commit(rating: GradeName) {
    if (lock.current || !session?.current || session.phase !== "card") return;
    lock.current = true;
    const id = session.current;
    try {
      const result = await grade(id, rating, mode === "practice");
      setPicked(null);
      setSession((current) =>
        current
          ? gradeSession(current, Date.now(), {
              id,
              rating,
              nextDue: result.nextDue,
              shortTerm: result.shortTerm,
            })
          : current,
      );
    } finally {
      lock.current = false;
    }
  }

  function choose(id: string) {
    if (picked || lock.current || !word || !session || session.phase !== "card") return;
    setPicked(id);
    const right = id === word.id;
    setTally((current) => addTap(current, right));
    playEffect(right ? "correct" : "incorrect");
    window.setTimeout(() => speakEnglish(word.lemma), 450);
    const rating: GradeName = right ? "good" : "again";
    wait.current = window.setTimeout(() => {
      void commit(rating);
    }, 1500);
  }

  if (session && session.phase !== "done" && !open) {
    return <CountOverlay beat={beat ?? "ready"} />;
  }

  if (!session) {
    return (
      <Frame>
        <main className="flex flex-1 items-center justify-center">
          <p className="font-display text-3xl">English Cards</p>
        </main>
      </Frame>
    );
  }

  if (session.phase === "done") {
    return <SessionEnd session={session} minutes={settings.minutes} mode={mode} topic={topic} tally={tally} onAgain={onAgain} />;
  }

  if (session.phase === "hold") {
    const seconds = Math.max(1, Math.ceil((session.holdUntil - now) / 1000));
    return (
      <Frame>
        <SessionHeader session={session} now={now} practice={mode === "practice"} />
        <main className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="hold-pulse font-display text-4xl tracking-tight">One moment</p>
          <p className="mt-4 max-w-xs text-pretty text-muted">
            That word comes back in this session. Not as the next card.
          </p>
          <p className="mt-6 text-sm tabular-nums text-muted">{seconds}s</p>
        </main>
      </Frame>
    );
  }

  if (!word || !row) {
    return (
      <Frame>
        <main className="flex flex-1 flex-col justify-center px-6">
          <p>That card is missing.</p>
          <Link to="/" className="mt-6 text-accent">
            Back to today
          </Link>
        </main>
      </Frame>
    );
  }

  const gloss = row.arabic ?? word.ar;
  const missed = picked != null && picked !== word.id;
  const nextMisses = row.failCount + (missed ? 1 : 0);

  return (
    <Frame className="h-dvh overflow-hidden">
      <SessionHeader session={session} now={now} practice={mode === "practice"} />
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <article key={word.id} className="desk-card screen-in relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-line bg-card">
          <div className="h-1.5 shrink-0 bg-accent" />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-4 pb-5">
            {picture ? (
              <div className="flex h-56 w-full items-center justify-center overflow-hidden rounded-2xl bg-paper">
                <img src={picture} alt="" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <p lang="ar" dir="rtl" className="mt-4 text-center font-arabic text-4xl leading-relaxed">
                {gloss}
              </p>
            )}
            <p className="mt-4 text-sm text-muted">
              {picture ? "Which word is this?" : "No picture on this card yet. Which English word is this?"}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {choices.map((choice) => {
                const right = picked != null && choice.id === word.id;
                const wrong = picked === choice.id && choice.id !== word.id;
                const tone = right
                  ? "relative border-accent bg-accent text-paper"
                  : wrong
                    ? "answer-wrong relative"
                    : "border-line bg-paper text-ink";
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={picked != null}
                    onClick={() => choose(choice.id)}
                    className={`min-h-12 rounded-full border px-4 text-left font-display text-2xl tracking-tight ${tone} ${missed && right ? "shake" : ""}`}
                  >
                    {right && !missed ? <Sparkles /> : null}
                    {choice.lemma}
                  </button>
                );
              })}
            </div>
            {picked ? (
              <div className="reveal mt-4">
                {picture ? (
                  <p lang="ar" dir="rtl" className="font-arabic text-right text-3xl leading-relaxed">
                    {gloss}
                  </p>
                ) : null}
                {word.example ? (
                  <div className="mt-3">
                    <ExampleLine example={word.example} highlight={word.highlight} />
                  </div>
                ) : null}
                <p className="mt-3 text-sm text-muted">
                  {missed
                    ? nextMisses >= 2
                      ? row.failCount >= 2
                        ? "That's a miss. It counts as didn't know. This word stays in Slipping."
                        : "That's a miss. It counts as didn't know, and the word goes to Slipping."
                      : "That's a miss. It counts as didn't know."
                    : "That's the one."}
                </p>
              </div>
            ) : null}
          </div>
        </article>
      </div>
      {beat === "go" ? <CountOverlay beat="go" /> : null}
    </Frame>
  );
}

function CountOverlay({ beat }: { beat: "ready" | "3" | "2" | "1" | "go" }) {
  const text = beat === "ready" ? "Get ready" : beat === "go" ? "START!" : beat;
  const motion = beat === "3" ? "count-soft" : beat === "2" ? "count-mid" : beat === "1" || beat === "go" ? "count-hard" : "";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper px-6">
      <p key={beat} className={`text-center font-display text-7xl font-bold tracking-tight text-balance ${motion}`}>
        {text}
      </p>
    </div>
  );
}

function choiceSalt(id: string, misses: number): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  }
  return (hash + misses * 97) >>> 0;
}

function SessionHeader({ session, now, practice }: { session: Session; now: number; practice: boolean }) {
  const ahead = queueAhead(session);
  const total = Math.max(1, session.graded + ahead);
  const position = Math.min(total, session.graded + 1);
  const used = practice
    ? session.graded / Math.max(1, session.graded + ahead)
    : Math.min(1, Math.max(0, (now - session.startedAt) / session.limitMs));
  return (
    <header className="safe-top px-5 pb-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm tabular-nums text-muted">
          {practice ? "Practice · " : ""}
          {position} of {total}
        </p>
        <Link to="/" className="min-h-11 text-sm text-muted">
          Close
        </Link>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full bg-accent" style={{ width: `${used * 100}%` }} />
      </div>
    </header>
  );
}

function SessionEnd({
  session,
  minutes,
  mode,
  topic,
  tally,
  onAgain,
}: {
  session: Session;
  minutes: number;
  mode: "scheduled" | "practice";
  topic?: string;
  tally: Tally;
  onAgain: () => void;
}) {
  const timedOut = session.endReason === "time";
  const waiting = mode === "scheduled" && timedOut && session.fresh.length > 0;
  const title =
    mode === "practice"
      ? session.graded === 0
        ? topic
          ? "Nothing in this group."
          : "Add words first."
        : "Round done."
      : session.graded === 0
        ? "Nothing is scheduled."
        : timedOut
          ? `That's ${minutes} minutes.`
          : "Scheduled pile is clear.";
  const detail =
    mode === "practice"
      ? session.graded === 0
        ? "Practice uses the words already in the deck. Add some, then come straight back."
        : "You do not have to wait until tomorrow. Start another round, or play a game."
      : waiting
        ? "Reviews filled the time. New words can wait, or you can practice what you already know."
        : "The timer is only for the scheduled pile. Practice and games stay open.";
  return (
    <Frame>
      <main className="flex flex-1 flex-col justify-center px-6">
        <p className="text-sm tabular-nums text-muted">{session.graded === 0 ? "Today" : `${session.graded} graded`}</p>
        <h1 className="mt-2 font-display text-5xl tracking-tight text-balance">{title}</h1>
        {tally.attempts > 0 ? <ScoreReport tally={tally} /> : null}
        <p className="mt-4 text-pretty text-muted">{detail}</p>
        {mode === "practice" && session.graded > 0 ? (
          <button
            type="button"
            onClick={onAgain}
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper"
          >
            Another round
          </button>
        ) : (
          <Link
            to="/review"
            search={{ mode: "practice", ...(topic ? { topic } : {}) }}
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper"
          >
            Practice again
          </Link>
        )}
        <Link
          to="/play"
          search={topic ? { topic } : {}}
          className="mt-3 inline-flex min-h-12 items-center justify-center rounded-full border border-line px-5 text-base font-medium"
        >
          Play a game
        </Link>
        <Link to="/" className="mt-4 text-center text-sm text-muted">
          Back to today
        </Link>
      </main>
    </Frame>
  );
}
