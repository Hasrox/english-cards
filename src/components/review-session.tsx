import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { wordById } from "@/data/words";
import { practicePinnedIds, practiceQuizIds, quizChoices } from "@/lib/cards/groups";
import {
  advance,
  createSession,
  gradeSession,
  queueAhead,
  type Session,
} from "@/lib/cards/session";
import { speakEnglish } from "@/lib/cards/speech";
import { playEffect, playFinish } from "@/lib/cards/sounds";
import { ART_ENABLED, BEAT_ART, type Beat } from "@/lib/cards/countdown-media";
import { GO_MS, ONE_MS, OVERLAY_CLEAR_MS, THREE_MS, TWO_MS } from "@/lib/cards/countdown-timing";
import { usePracticeClock } from "@/lib/cards/clock";
import { dueIds } from "@/lib/cards/stats";
import { useVault } from "@/lib/cards/store";
import type { GradeName } from "@/lib/cards/types";
import { haptics } from "@/lib/motion/haptics";
import { DURATION, EASE, SPRING, TRANSITION } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";
import { AnimatePresence, m } from "motion/react";
import { Frame } from "./chrome";
import { ExampleLine } from "./example-line";
import { EMPTY_TALLY, ScoreReport, Sparkles, addTap, type Tally } from "./score-report";
import { useLocalPicture } from "./use-picture";

export function ReviewSession({
  mode,
  topic,
  words,
  round,
  onAgain,
}: {
  mode: "scheduled" | "practice";
  topic?: string;
  words?: string[];
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
  const [beat, setBeat] = useState<Beat | null>(null);
  const reduced = useReducedMotion();
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
      timers.push(
        window.setTimeout(() => {
          if (!cancel) fn();
        }, ms),
      );
    };
    const countdown = new Audio("/sounds/3-sec-countdown.mp3");
    const ready = new Audio("/sounds/get-ready-for-the-next-battle.mp3");
    const beginCount = () => {
      if (cancel || counted) return;
      counted = true;
      void countdown.play().catch(() => undefined);
      // The mp3 opens with ~1.1 s of silence, so the visuals are offset to the
      // measured beep positions rather than assuming the first beep is at t=0.
      // See src/lib/cards/countdown-timing.ts.
      later(THREE_MS, () => setBeat("3"));
      later(TWO_MS, () => setBeat("2"));
      later(ONE_MS, () => setBeat("1"));
      later(GO_MS, () => {
        setBeat("go");
        setOpen(true);
        setSession((current) => (current ? { ...current, startedAt: Date.now() } : current));
      });
      later(OVERLAY_CLEAR_MS, () => setBeat(null));
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
    // v0.65 Learn loop: scheduled review is due-only. New cards go through
    // `/learn` (teach-first), never the 4-choice quiz.
    setSession(
      createSession({
        now,
        limitMs: mode === "practice" ? 3 * 60 * 60_000 : settings.minutes * 60_000,
        dueIds:
          mode === "practice"
            ? words && words.length > 0
              ? practicePinnedIds(progress, words, round)
              : practiceQuizIds(progress, topic, now, 16, round)
            : dueIds(progress, now),
        freshIds: [],
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
    return quizChoices(
      word,
      own.length ? library.concat(own) : library,
      choiceSalt(word.id, row?.failCount ?? 0),
    );
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
    if (right) haptics.correct();
    else haptics.wrong();
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
    return (
      <SessionEnd
        session={session}
        minutes={settings.minutes}
        mode={mode}
        topic={topic}
        tally={tally}
        onAgain={onAgain}
      />
    );
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
        <AnimatePresence mode="popLayout">
          <m.article
            key={word.id}
            className="desk-card relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-line bg-card"
            initial={{ opacity: 0, y: 24 }}
            animate={
              picked && !missed && !reduced
                ? {
                    opacity: 1,
                    y: 0,
                    scale: [1, 1.04, 1],
                    transition: {
                      ...TRANSITION.standard,
                      scale: { duration: DURATION.slow, ease: EASE.standard },
                    },
                  }
                : {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: reduced ? { duration: 0 } : SPRING.soft,
                  }
            }
            exit={{ opacity: 0, x: -40, transition: { duration: DURATION.fast, ease: EASE.exit } }}
          >
            <div className="h-1.5 shrink-0 bg-accent" />
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-4 pb-5">
              {picture ? (
                <div className="flex h-56 w-full items-center justify-center overflow-hidden rounded-2xl bg-paper">
                  <img src={picture} alt="" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <p
                  lang="ar"
                  dir="rtl"
                  className="mt-4 text-center font-arabic text-4xl leading-relaxed"
                >
                  {gloss}
                </p>
              )}
              <p className="mt-4 text-sm text-muted">
                {picture
                  ? "Which word is this?"
                  : "No picture on this card yet. Which English word is this?"}
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
                  const shake = missed && right;
                  return (
                    <m.button
                      key={choice.id}
                      type="button"
                      disabled={picked != null}
                      onClick={() => choose(choice.id)}
                      className={`min-h-12 rounded-full border px-4 text-left font-display text-2xl tracking-tight ${tone}`}
                      animate={shake && !reduced ? { x: [0, -6, 6, 0] } : { x: 0 }}
                      transition={
                        shake && !reduced
                          ? { duration: 0.42, times: [0, 0.25, 0.75, 1] }
                          : { duration: 0 }
                      }
                    >
                      {right && !missed ? <Sparkles /> : null}
                      {choice.lemma}
                    </m.button>
                  );
                })}
              </div>
              {picked ? (
                <div className="reveal mt-4">
                  {picture ? (
                    <p
                      lang="ar"
                      dir="rtl"
                      className="font-arabic text-right text-3xl leading-relaxed"
                    >
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
          </m.article>
        </AnimatePresence>
      </div>
      {beat === "go" ? <CountOverlay beat="go" /> : null}
    </Frame>
  );
}

/**
 * Countdown gate (PRD FR-2.3), beats driven by the existing audio schedule:
 * `ready` -> `3` -> `2` -> `1` -> `go`.
 *
 * Art playback walks a fallback chain per beat — alpha WebM, then animated
 * WebP, then the static still, then the original text. `ART_ENABLED` is false
 * until verified alpha art lands (see src/lib/cards/countdown-media.ts), so
 * today the text treatment renders; the machinery is in place and tested so
 * enabling art is a one-line flip plus the generated files.
 *
 * Behaviour that must survive either way:
 * - the video restarts on every beat (keyed by `beat`, re-played on mount);
 * - `muted` + `playsInline`, so autoplay is allowed in the WebView;
 * - a clip that ends early holds its final frame instead of blanking —
 *   `onEnded` pauses on the last frame rather than clearing the source;
 * - reduced motion never plays video: it shows the static frame (or the text).
 */
function CountOverlay({ beat }: { beat: Beat }) {
  const reduced = useReducedMotion();
  const art = ART_ENABLED ? BEAT_ART[beat] : null;
  const [stage, setStage] = useState<"webm" | "webp" | "still" | "text">(art ? "webm" : "text");
  // Restart on each beat; the key change remounts the element, so the browser
  // fetches/plays from 0 rather than resuming a stale position.
  useEffect(() => {
    setStage(art ? "webm" : "text");
  }, [art, beat]);
  const showText = !art || stage === "text";
  // Graduated intensity per beat — preserves the old count-soft/mid/hard
  // mapping: later beats start smaller and land with a bigger spring.
  const startScale =
    beat === "ready" ? 0.8 : beat === "3" ? 0.78 : beat === "2" ? 0.7 : beat === "1" ? 0.62 : 0.55;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper px-6">
      <m.p
        key={beat}
        initial={
          reduced
            ? { opacity: 1, scale: 1, filter: "blur(0px)" }
            : { opacity: 0, scale: startScale, filter: "blur(8px)" }
        }
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={
          reduced
            ? { duration: 0 }
            : { scale: SPRING.bouncy, opacity: TRANSITION.fast, filter: TRANSITION.fast }
        }
        className="text-center font-display text-7xl font-bold tracking-tight text-balance"
      >
        {showText ? (
          (art?.text ?? BEAT_ART[beat].text)
        ) : (
          <m.span
            initial={false}
            animate={reduced ? { opacity: 1 } : { scale: [1, 1.06, 1] }}
            transition={reduced ? { duration: 0 } : { duration: 0.9, ease: "easeOut" }}
            className="block"
          >
            {/* Reduced motion always resolves to the static final frame. */}
            {stage === "webm" && !reduced ? (
              <video
                key={`${beat}-${stage}`}
                src={art?.webm}
                autoPlay
                muted
                playsInline
                preload="auto"
                onEnded={(event) => {
                  // Hold the final frame rather than blanking the overlay.
                  event.currentTarget.pause();
                }}
                onError={() => setStage("webp")}
                className="mx-auto w-[min(80vw,26rem)]"
              />
            ) : stage === "webp" && !reduced ? (
              <img
                src={art?.webp}
                alt={art?.text ?? beat}
                onError={() => setStage("still")}
                className="mx-auto w-[min(80vw,26rem)]"
              />
            ) : (
              <img
                src={art?.still}
                alt={art?.text ?? beat}
                onError={() => setStage("text")}
                className="mx-auto w-[min(80vw,26rem)]"
              />
            )}
          </m.span>
        )}
      </m.p>
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

function SessionHeader({
  session,
  now,
  practice,
}: {
  session: Session;
  now: number;
  practice: boolean;
}) {
  const reduced = useReducedMotion();
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
        <m.div
          className="h-full bg-accent"
          initial={false}
          animate={{ width: `${used * 100}%` }}
          transition={reduced ? { duration: 0 } : TRANSITION.standard}
        />
      </div>
    </header>
  );
}

/**
 * One session-end action that staggers in after the score arc completes
 * (PRD FR-3 · Phase 3): starts at 950ms, 60ms apart per index.
 * `w-full` on the inner child keeps the pre-Phase 3 stretched layout
 * (actions were full-content-width flex children: baseline 342px @390vw).
 */
function EndAction({ index, children }: { index: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className="w-full"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: DURATION.base, ease: EASE.standard, delay: 0.95 + index * 0.06 }
      }
    >
      {children}
    </m.div>
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
      : session.graded === 0
        ? "Reviews are for words you already met. New words start on Learn."
        : "The timer is only for the scheduled pile. Practice and games stay open.";
  return (
    <Frame>
      <main className="flex flex-1 flex-col justify-center px-6">
        <p className="text-sm tabular-nums text-muted">
          {session.graded === 0 ? "Today" : `${session.graded} graded`}
        </p>
        <h1 className="mt-2 font-display text-5xl tracking-tight text-balance">{title}</h1>
        {tally.attempts > 0 ? <ScoreReport tally={tally} /> : null}
        <p className="mt-4 text-pretty text-muted">{detail}</p>
        {mode === "practice" && session.graded > 0 ? (
          <EndAction index={0}>
            <button
              type="button"
              onClick={onAgain}
              className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper"
            >
              Another round
            </button>
          </EndAction>
        ) : (
          <EndAction index={0}>
            <Link
              to="/review"
              search={{ mode: "practice", ...(topic ? { topic } : {}) }}
              className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-5 text-base font-medium text-paper"
            >
              Practice again
            </Link>
          </EndAction>
        )}
        <EndAction index={1}>
          <Link
            to="/play"
            search={topic ? { topic } : {}}
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-line px-5 text-base font-medium"
          >
            Play a game
          </Link>
        </EndAction>
        <EndAction index={2}>
          <Link to="/" className="mt-4 block w-full text-center text-sm text-muted">
            Back to today
          </Link>
        </EndAction>
      </main>
    </Frame>
  );
}
