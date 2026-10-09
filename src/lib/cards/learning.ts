/**
 * Pure Learn-loop helpers for v0.65 (teach before test).
 * No React, no vault I/O — callers inject word lookup when needed.
 */
import { isNewState } from "./fsrs.ts";
import { dayKey } from "./time.ts";
import type { Progress, Settings } from "./types.ts";

/** Minimal word fields the Learn helpers need (from `wordById` in app code). */
export type LearnWordInfo = {
  id: string;
  lemma: string;
  rank: number;
  topic: string;
  pos: string;
  ar: string;
};

export type LearnLookup = (id: string) => LearnWordInfo | undefined;

export type MatchMode = "picture" | "en-ar";

export type MatchBoardPair = {
  wordId: string;
  lemma: string;
  gloss: string;
  mode: MatchMode;
  /** True when the word is in the Learn batch (not a known filler). */
  isTarget: boolean;
};

export type MatchBoard = {
  pairs: MatchBoardPair[];
};

export type SpellCell = {
  char: string;
  gap: boolean;
};

export type SpellPuzzle = {
  lemma: string;
  cells: SpellCell[];
  /** Lowercase letters that fill the gaps, in gap order. */
  answers: string[];
  /** Shuffled tiles: answers + distractors. */
  tiles: string[];
};

export type SpellMark = "match" | "miss" | "extra" | "missing";

export type SpellDiffCell = {
  expected: string | null;
  got: string | null;
  mark: SpellMark;
};

export type LearnStage = "learn" | "match" | "spell" | "type" | "done";

export type LearnWordResult = {
  spellRetries: number;
  typeRetries: number;
};

export type LearnSession = {
  batchIds: string[];
  stage: LearnStage;
  /** Cursor within the current stage (word index for learn/spell/type). */
  index: number;
  /** Cursor for Match sub-boards. */
  boardIndex: number;
  results: Record<string, LearnWordResult>;
};

/** ScoreReport shape for a finished Learn batch. */
export type LearnTally = {
  correct: number;
  attempts: number;
};

const TOP100 = "top100";
const TOP500 = "top500";
const ALPHA = "abcdefghijklmnopqrstuvwxyz";

function wordGroupIds(word: LearnWordInfo): string[] {
  const groups = [word.topic];
  if (word.rank >= 1 && word.rank <= 500 && word.topic !== TOP500) groups.push(TOP500);
  if (word.rank >= 1 && word.rank <= 100 && word.topic !== TOP100) groups.push(TOP100);
  return groups;
}

/** Topic / island filter (same rules as `inGroup`, minus slip — Learn never uses slip). */
export function matchesLearnTopic(word: LearnWordInfo, topic?: string): boolean {
  if (!topic) return true;
  const split = topic.indexOf(":");
  const head = split === -1 ? topic : topic.slice(0, split);
  const pos = split === -1 ? "" : topic.slice(split + 1);
  if (head === "__slip") return false;
  if (!wordGroupIds(word).includes(head)) return false;
  if (pos && word.pos !== pos) return false;
  return true;
}

function seededShuffle<T>(items: T[], salt: number): T[] {
  const copy = items.slice();
  let state = (salt + 1) >>> 0 || 1;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swapAt = state % (index + 1);
    const swap = copy[index];
    copy[index] = copy[swapAt]!;
    copy[swapAt] = swap!;
  }
  return copy;
}

function seededPick<T>(items: T[], count: number, salt: number): T[] {
  if (count <= 0 || items.length === 0) return [];
  return seededShuffle(items, salt).slice(0, Math.min(count, items.length));
}

/**
 * New-only batch for Learn. Size = remaining daily `newCap` (same room as today's freshIds).
 * Optional `topic` scopes to an island / list group.
 */
export function learningBatch(
  progress: Record<string, Progress>,
  settings: Pick<Settings, "newCap">,
  now: number,
  lookup: LearnLookup,
  topic?: string,
): string[] {
  const today = dayKey(now);
  let used = 0;
  for (const row of Object.values(progress)) {
    if (row.introducedOn === today) used += 1;
  }
  const room = Math.max(0, settings.newCap - used);
  if (room === 0) return [];

  const pool: Array<{ id: string; rank: number }> = [];
  for (const row of Object.values(progress)) {
    if (row.retired) continue;
    if (!isNewState(row.card.state)) continue;
    const word = lookup(row.wordId);
    if (!word) continue;
    if (!matchesLearnTopic(word, topic)) continue;
    pool.push({ id: row.wordId, rank: word.rank });
  }

  pool.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  return pool.slice(0, Math.min(room, pool.length)).map((item) => item.id);
}

/** Picture match when the card has art; otherwise English ↔ Arabic. */
export function matchMode(row: Pick<Progress, "hasPicture">): MatchMode {
  return row.hasPicture ? "picture" : "en-ar";
}

function glossFor(row: Progress, word: LearnWordInfo): string {
  return (row.arabic ?? word.ar).trim();
}

/**
 * Build Match boards for a Learn batch: target words + 2–3 known fillers when
 * possible, chunked into sub-boards of at most 4 pairs. Per-pair mode follows
 * `matchMode` (picture ↔ EN, or EN ↔ AR).
 */
export function matchBoards(
  batchIds: string[],
  progress: Record<string, Progress>,
  lookup: LearnLookup,
  opts?: { fillerCount?: number; boardSize?: number; salt?: number },
): MatchBoard[] {
  const boardSize = opts?.boardSize ?? 4;
  const wantFillers = opts?.fillerCount ?? 3;
  const salt = opts?.salt ?? 0;
  if (batchIds.length === 0) return [];

  const batchSet = new Set(batchIds);
  const pairs: MatchBoardPair[] = [];

  for (const id of batchIds) {
    const word = lookup(id);
    const row = progress[id];
    if (!word || !row || row.retired) continue;
    const gloss = glossFor(row, word);
    if (!gloss) continue;
    pairs.push({
      wordId: id,
      lemma: word.lemma,
      gloss,
      mode: matchMode(row),
      isTarget: true,
    });
  }

  if (pairs.length === 0) return [];

  const topicHint = new Set(pairs.map((p) => lookup(p.wordId)?.topic).filter(Boolean) as string[]);

  const fillerCandidates: MatchBoardPair[] = [];
  for (const row of Object.values(progress)) {
    if (row.retired || batchSet.has(row.wordId)) continue;
    if (isNewState(row.card.state)) continue;
    const word = lookup(row.wordId);
    if (!word) continue;
    const gloss = glossFor(row, word);
    if (!gloss) continue;
    fillerCandidates.push({
      wordId: row.wordId,
      lemma: word.lemma,
      gloss,
      mode: matchMode(row),
      isTarget: false,
    });
  }

  const preferred = fillerCandidates.filter((p) => {
    const topic = lookup(p.wordId)?.topic;
    return topic != null && topicHint.has(topic);
  });
  const preferredIds = new Set(preferred.map((p) => p.wordId));
  const rest = fillerCandidates.filter((p) => !preferredIds.has(p.wordId));
  const fillerPool = [
    ...seededShuffle(preferred, salt + 11),
    ...seededShuffle(rest, salt + 13),
  ];
  const fillerTake = Math.min(wantFillers, fillerPool.length);
  // Prefer at least 2 when the pool allows; otherwise take what we have.
  const fillers = fillerPool.slice(0, fillerTake);

  const allPairs = seededShuffle([...pairs, ...fillers], salt + 17);

  const boards: MatchBoard[] = [];
  for (let i = 0; i < allPairs.length; i += boardSize) {
    boards.push({ pairs: allPairs.slice(i, i + boardSize) });
  }
  return boards;
}

/**
 * Gap mask for "Spell it": keep first/last letter when the word is long enough;
 * gap the middles. Short words gap what they can. Tiles = needed letters + distractors.
 */
export function spellPuzzle(lemma: string, salt = 0): SpellPuzzle {
  const chars = [...lemma];
  const letterIdxs: number[] = [];
  for (let i = 0; i < chars.length; i += 1) {
    if (/[a-zA-Z]/.test(chars[i]!)) letterIdxs.push(i);
  }

  const gapAt = new Set<number>();
  if (letterIdxs.length === 1) {
    gapAt.add(letterIdxs[0]!);
  } else if (letterIdxs.length === 2) {
    gapAt.add(letterIdxs[1]!);
  } else if (letterIdxs.length >= 3) {
    const first = letterIdxs[0]!;
    const last = letterIdxs[letterIdxs.length - 1]!;
    for (const idx of letterIdxs) {
      if (idx !== first && idx !== last) gapAt.add(idx);
    }
  }

  const cells: SpellCell[] = chars.map((char, index) => ({
    char,
    gap: gapAt.has(index),
  }));
  const answers = cells.filter((cell) => cell.gap).map((cell) => cell.char.toLowerCase());

  const needed = new Set(answers);
  const distractorPool = [...ALPHA].filter((ch) => !needed.has(ch));
  // Enough tiles to feel like a choice without flooding short words.
  const distractorCount = Math.min(4, Math.max(2, 6 - answers.length));
  const distractors = seededPick(distractorPool, distractorCount, salt + 3).map((ch) => ch);
  const tiles = seededShuffle([...answers, ...distractors], salt + 5);

  return { lemma, cells, answers, tiles };
}

/** Per-letter diff for wrong spell attempts (truth feedback before retry). */
export function spellDiff(target: string, attempt: string): SpellDiffCell[] {
  const expected = [...target.trim().toLowerCase()];
  const got = [...attempt.trim().toLowerCase()];
  const len = Math.max(expected.length, got.length);
  const out: SpellDiffCell[] = [];
  for (let i = 0; i < len; i += 1) {
    const exp = expected[i] ?? null;
    const g = got[i] ?? null;
    if (exp != null && g != null) {
      out.push({ expected: exp, got: g, mark: exp === g ? "match" : "miss" });
    } else if (exp != null) {
      out.push({ expected: exp, got: null, mark: "missing" });
    } else {
      out.push({ expected: null, got: g, mark: "extra" });
    }
  }
  return out;
}

/** Case-insensitive exact check for "Type it". */
export function typeCheck(lemma: string, input: string): boolean {
  return lemma.trim().toLowerCase() === input.trim().toLowerCase();
}

/**
 * FSRS grade when the word is introduced after Spell + Type.
 * Good only if both production stages were clean (zero retries).
 */
export function introduceRating(input: {
  spellRetries: number;
  typeRetries: number;
}): "good" | "hard" {
  if (input.spellRetries <= 0 && input.typeRetries <= 0) return "good";
  return "hard";
}

export function createLearnSession(batchIds: string[]): LearnSession {
  const ids = batchIds.slice();
  const results: Record<string, LearnWordResult> = {};
  for (const id of ids) {
    results[id] = { spellRetries: 0, typeRetries: 0 };
  }
  return {
    batchIds: ids,
    stage: ids.length === 0 ? "done" : "learn",
    index: 0,
    boardIndex: 0,
    results,
  };
}

export function ratingForWord(session: LearnSession, wordId: string): "good" | "hard" {
  const row = session.results[wordId] ?? { spellRetries: 0, typeRetries: 0 };
  return introduceRating(row);
}

/**
 * ScoreReport tallies for a finished Learn batch.
 * One attempt per batch word; "correct" = clean Spell+Type (introduce rating good).
 */
export function learnTally(session: LearnSession): LearnTally {
  const attempts = session.batchIds.length;
  let correct = 0;
  for (const id of session.batchIds) {
    if (ratingForWord(session, id) === "good") correct += 1;
  }
  return { correct, attempts };
}

/** Child-facing stage title. */
export function learnStageTitle(stage: LearnStage): string {
  switch (stage) {
    case "learn":
      return "Learn it";
    case "match":
      return "Match it";
    case "spell":
      return "Spell it";
    case "type":
      return "Type it";
    case "done":
      return "Done";
  }
}

/** Active batch word for learn / spell / type. Match uses boards instead. */
export function currentBatchWordId(session: LearnSession): string | null {
  if (session.stage === "learn" || session.stage === "spell" || session.stage === "type") {
    return session.batchIds[session.index] ?? null;
  }
  return null;
}

/** 1-based progress within the current stage. */
export function learnStageProgress(
  session: LearnSession,
  boardCount = 0,
): { current: number; total: number } {
  const n = session.batchIds.length;
  switch (session.stage) {
    case "learn":
    case "spell":
    case "type":
      return { current: n === 0 ? 0 : Math.min(session.index + 1, n), total: n };
    case "match": {
      const total = Math.max(boardCount, 0);
      if (total === 0) return { current: 0, total: 0 };
      return { current: Math.min(session.boardIndex + 1, total), total };
    }
    case "done":
      return { current: n, total: n };
  }
}

/**
 * Learn it · Got it — advance word cursor; after the last word enter Match
 * (or Spell when there are no match boards).
 */
export function advanceLearnGotIt(session: LearnSession, matchBoardCount = 0): LearnSession {
  if (session.stage !== "learn") return session;
  const next = session.index + 1;
  if (next < session.batchIds.length) {
    return { ...session, index: next };
  }
  if (matchBoardCount > 0) {
    return { ...session, stage: "match", index: 0, boardIndex: 0 };
  }
  return { ...session, stage: "spell", index: 0, boardIndex: 0 };
}

/**
 * Match it · one sub-board cleared. When boards are exhausted (or none),
 * enter Spell it. Does not touch FSRS / introduce.
 */
export function advanceMatchBoard(session: LearnSession, boardCount: number): LearnSession {
  if (session.stage !== "match") return session;
  if (boardCount <= 0) {
    return { ...session, stage: "spell", index: 0, boardIndex: 0 };
  }
  const next = session.boardIndex + 1;
  if (next >= boardCount) {
    return { ...session, stage: "spell", index: 0, boardIndex: 0 };
  }
  return { ...session, boardIndex: next };
}

function bumpRetry(
  session: LearnSession,
  wordId: string,
  field: "spellRetries" | "typeRetries",
): LearnSession {
  if (!session.batchIds.includes(wordId)) return session;
  const prev = session.results[wordId] ?? { spellRetries: 0, typeRetries: 0 };
  return {
    ...session,
    results: {
      ...session.results,
      [wordId]: { ...prev, [field]: prev[field] + 1 },
    },
  };
}

/** Count a failed Spell attempt (retry until right; no skip). */
export function noteSpellRetry(session: LearnSession, wordId: string): LearnSession {
  return bumpRetry(session, wordId, "spellRetries");
}

/** Count a failed Type attempt (retry until right; no skip). */
export function noteTypeRetry(session: LearnSession, wordId: string): LearnSession {
  return bumpRetry(session, wordId, "typeRetries");
}

/**
 * Spell it · correct for the current word. After the last word enter Type it.
 * Wrong attempts must call `noteSpellRetry` and stay on the same index.
 */
export function advanceSpellCorrect(session: LearnSession): LearnSession {
  if (session.stage !== "spell") return session;
  const next = session.index + 1;
  if (next < session.batchIds.length) {
    return { ...session, index: next };
  }
  return { ...session, stage: "type", index: 0 };
}

/**
 * Type it · correct for the current word. After the last word → done.
 * Callers grade/introduce the finished word (vault `grade`) before or after this.
 */
export function advanceTypeCorrect(session: LearnSession): LearnSession {
  if (session.stage !== "type") return session;
  const next = session.index + 1;
  if (next < session.batchIds.length) {
    return { ...session, index: next };
  }
  return { ...session, stage: "done", index: 0 };
}
