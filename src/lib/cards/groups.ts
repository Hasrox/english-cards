import { wordById, type Word } from "@/data/words";
import { isNewState, isShortTerm } from "./fsrs";
import type { Progress } from "./types";

export const SLIP_ID = "__slip";

export const CATEGORY_ORDER = [
  "food",
  "home",
  "body",
  "animals",
  "nature",
  "people",
  "town",
  "feelings",
  "looks",
  "time",
  "actions",
  "work",
  "study",
  "language",
  "everyday",
] as const;

export const TOP100 = "top100";
export const TOP500 = "top500";

export const LIST_GROUPS = [TOP100, TOP500, ...CATEGORY_ORDER] as const;

const TOPIC_LABEL: Record<string, string> = {
  language: "Little words",
  people: "People",
  actions: "Doing",
  time: "Time",
  food: "Food",
  home: "Home",
  nature: "Outside",
  animals: "Animals",
  looks: "How it looks",
  study: "School",
  body: "Body",
  feelings: "Feelings",
  town: "Town",
  work: "Work",
  everyday: "Other",
  common: "Common",
  mine: "Your words",
  top100: "Top 100",
  top500: "Top 500",
};

const TOPIC_HINT: Record<string, string> = {
  language: "The small words that hold a sentence together.",
  people: "Who is in the sentence.",
  actions: "What someone does.",
  time: "When it happens.",
  food: "Things you eat and drink.",
  home: "The house and what is in it.",
  nature: "Weather, plants, and outside.",
  animals: "Creatures, pets, and wildlife.",
  looks: "Size, color, and what something is like.",
  study: "School and academic words.",
  body: "Parts of the body.",
  feelings: "How someone feels.",
  town: "Streets, shops, and places.",
  work: "Jobs and getting things done.",
  everyday: "Words that did not fit Food, Home, and the other groups.",
  common: "Frequent words from the open lists.",
  mine: "Words you added yourself.",
  top100: "The 100 most common words in the open list.",
  top500: "The 500 most common words in the open list. The top 100 are in here too.",
};

export type WordBand = "new" | "learning" | "due" | "known";

export type IslandGroup = {
  id: string;
  label: string;
  hint: string;
  words: string[];
  due: number;
  learning: number;
  fresh: number;
  known: number;
  slipping: number;
};

export type PlayWord = {
  id: string;
  lemma: string;
  gloss: string;
  pos: string;
  hasPicture: boolean;
  pictureRev: number;
};

export function topicLabel(topic: string): string {
  return TOPIC_LABEL[topic] ?? topic.charAt(0).toUpperCase() + topic.slice(1);
}

export function wordGroups(word: Word): string[] {
  const groups = [word.topic];
  if (word.rank >= 1 && word.rank <= 500 && word.topic !== TOP500) groups.push(TOP500);
  if (word.rank >= 1 && word.rank <= 100 && word.topic !== TOP100) groups.push(TOP100);
  return groups;
}

export function isLearned(row: Progress | undefined): boolean {
  if (!row || row.retired) return false;
  if (isNewState(row.card.state)) return false;
  return row.failCount < 2;
}

export function groupStats(words: Word[], progress: Record<string, Progress>): Map<string, { total: number; learned: number }> {
  const stats = new Map<string, { total: number; learned: number }>();
  for (const word of words) {
    const learned = isLearned(progress[word.id]);
    for (const id of wordGroups(word)) {
      const row = stats.get(id) ?? { total: 0, learned: 0 };
      row.total += 1;
      if (learned) row.learned += 1;
      stats.set(id, row);
    }
  }
  return stats;
}

export function wordBand(row: Progress, now = Date.now()): WordBand {
  if (isNewState(row.card.state)) return "new";
  if (isShortTerm(row.card.state)) return "learning";
  if (row.card.due <= now) return "due";
  return "known";
}

export function bandLabel(band: WordBand): string {
  if (band === "new") return "Not started";
  if (band === "learning") return "Learning";
  if (band === "due") return "Due";
  return "Known";
}

function aliveRows(progress: Record<string, Progress>): Progress[] {
  return Object.values(progress).filter((row) => !row.retired && wordById(row.wordId));
}

function needRank(row: Progress, now: number): number {
  if (row.failCount >= 5) return 0;
  if (row.failCount >= 2) return 1;
  const band = wordBand(row, now);
  if (band === "due") return 2;
  if (band === "learning") return 3;
  if (band === "new") return 5;
  return 4;
}

export function quizChoices(word: Word, library: Word[], salt = 0): Word[] {
  const other = (item: Word) => item.id !== word.id && item.lemma.toLowerCase() !== word.lemma.toLowerCase();
  const topic = library.filter((item) => other(item) && item.topic === word.topic);
  const sameKind = topic.filter((item) => item.pos === word.pos);
  const picked: Word[] = [];
  const used = new Set<string>([word.id]);
  for (const pool of [sameKind, topic, library.filter(other)]) {
    for (const item of seededShuffle(pool, salt + picked.length + pool.length)) {
      if (used.has(item.id)) continue;
      used.add(item.id);
      picked.push(item);
      if (picked.length === 3) return seededShuffle([...picked, word], salt + 9);
    }
  }
  return seededShuffle([...picked, word], salt + 9);
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

export function inGroup(word: Word, row: Progress, groupId?: string): boolean {
  if (!groupId) return true;
  if (groupId === SLIP_ID) return row.failCount >= 2;
  const split = groupId.indexOf(":");
  const topic = split === -1 ? groupId : groupId.slice(0, split);
  const pos = split === -1 ? "" : groupId.slice(split + 1);
  if (!wordGroups(word).includes(topic)) return false;
  if (pos && word.pos !== pos) return false;
  return true;
}

export function practiceRound(
  progress: Record<string, Progress>,
  groupId: string | undefined,
  now = Date.now(),
  limit = 16,
  rotate = 0,
): string[] {
  const rows = aliveRows(progress)
    .filter((row) => {
      const word = wordById(row.wordId);
      return word ? inGroup(word, row, groupId) : false;
    })
    .sort(
      (a, b) =>
        needRank(a, now) - needRank(b, now) ||
        b.failCount - a.failCount ||
        a.wordId.localeCompare(b.wordId),
    );
  if (rows.length === 0) return [];
  const start = rows.length <= limit ? 0 : (Math.max(0, rotate) * 8) % rows.length;
  const ordered = rows.slice(start).concat(rows.slice(0, start));
  return ordered.slice(0, Math.min(limit, ordered.length)).map((row) => row.wordId);
}

function toPlayWord(progress: Record<string, Progress>, id: string): PlayWord | null {
  const word = wordById(id);
  const row = progress[id];
  if (!word || !row) return null;
  const gloss = (row.arabic ?? word.ar).trim();
  if (!gloss) return null;
  return {
    id,
    lemma: word.lemma,
    gloss,
    pos: word.pos,
    hasPicture: row.hasPicture,
    pictureRev: row.pictureRev,
  };
}

export function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapAt = Math.floor(Math.random() * (index + 1));
    const swap = copy[index];
    copy[index] = copy[swapAt]!;
    copy[swapAt] = swap!;
  }
  return copy;
}

export function misalign<T>(items: T[], same: (left: T, right: T) => boolean): T[] {
  if (items.length < 2) return items.slice();
  let mixed = shuffle(items);
  for (let pass = 0; pass < 8; pass += 1) {
    let linedUp = false;
    for (let index = 0; index < mixed.length; index += 1) {
      if (!same(mixed[index]!, items[index]!)) continue;
      linedUp = true;
      const swapAt = (index + 1) % mixed.length;
      const swap = mixed[index]!;
      mixed[index] = mixed[swapAt]!;
      mixed[swapAt] = swap;
    }
    if (!linedUp) return mixed;
    mixed = shuffle(items);
  }
  for (let sweep = 0; sweep < 2; sweep += 1) {
    for (let index = 0; index < mixed.length; index += 1) {
      if (!same(mixed[index]!, items[index]!)) continue;
      const swapAt = (index + 1) % mixed.length;
      const swap = mixed[index]!;
      mixed[index] = mixed[swapAt]!;
      mixed[swapAt] = swap;
    }
  }
  return mixed;
}

export function nextSeen(seen: string[], dealt: string[], pool: number): string[] {
  const next = seen.concat(dealt.filter((id) => !seen.includes(id)));
  if (pool > 0 && next.length >= pool) return dealt.slice();
  return next;
}

function glossPool(progress: Record<string, Progress>, groupId: string | undefined, lettersOnly: boolean): PlayWord[] {
  const ids = practiceRound(progress, groupId, Date.now(), 2000, 0);
  const seen = new Set<string>();
  const out: PlayWord[] = [];
  for (const id of ids) {
    const play = toPlayWord(progress, id);
    if (!play || seen.has(play.gloss)) continue;
    if (lettersOnly && letterIndex(play.lemma, 1) == null) continue;
    seen.add(play.gloss);
    out.push(play);
  }
  return out;
}

function draw(pool: PlayWord[], avoid: string[], limit: number): PlayWord[] {
  const used = new Set(avoid);
  let fresh = pool.filter((word) => !used.has(word.id));
  if (fresh.length < limit) {
    const fill = shuffle(pool.filter((word) => !fresh.some((item) => item.id === word.id)));
    fresh = fresh.concat(fill);
  }
  return shuffle(fresh).slice(0, Math.min(limit, fresh.length));
}

export function distinctWords(
  progress: Record<string, Progress>,
  groupId: string | undefined,
  limit: number,
  avoid: string[] = [],
): PlayWord[] {
  return draw(glossPool(progress, groupId, false), avoid, limit);
}

export function gamePoolSize(progress: Record<string, Progress>, groupId: string | undefined, lettersOnly = false): number {
  return glossPool(progress, groupId, lettersOnly).length;
}

export function letterIndex(lemma: string, roll: number): number | null {
  const chars = [...lemma];
  const letters = chars
    .map((char, index) => (/[a-zA-Z]/.test(char) ? index : -1))
    .filter((index) => index >= 0);
  if (letters.length < 3) return null;
  const middle = letters.filter((index) => index !== 0 && index !== letters[letters.length - 1]);
  const pool = middle.length > 0 ? middle : letters;
  const pick = pool[Math.abs(roll) % pool.length];
  return pick ?? null;
}

export function letterRound(
  progress: Record<string, Progress>,
  groupId: string | undefined,
  avoid: string[] = [],
): Array<PlayWord & { index: number }> {
  return draw(glossPool(progress, groupId, true), avoid, 8).flatMap((play) => {
    const index = letterIndex(play.lemma, Math.floor(Math.random() * 997));
    return index == null ? [] : [{ ...play, index }];
  });
}

export function islandGroups(progress: Record<string, Progress>, now = Date.now()): IslandGroup[] {
  const buckets = new Map<string, Progress[]>();
  const slip: Progress[] = [];
  for (const row of aliveRows(progress)) {
    const word = wordById(row.wordId);
    if (!word) continue;
    const list = buckets.get(word.topic) ?? [];
    list.push(row);
    buckets.set(word.topic, list);
    for (const extra of wordGroups(word)) {
      if (extra === word.topic) continue;
      const more = buckets.get(extra) ?? [];
      more.push(row);
      buckets.set(extra, more);
    }
    if (row.failCount >= 2) slip.push(row);
  }

  const groups: IslandGroup[] = [];
  if (slip.length > 0) {
    groups.push(summarize(SLIP_ID, "Slipping", "Missed more than once. Revise these any time.", slip, now));
  }

  const topics: IslandGroup[] = [];
  for (const [topic, rows] of buckets) {
    const hint = TOPIC_HINT[topic] ?? "Words that belong together.";
    topics.push(summarize(topic, topicLabel(topic), hint, rows, now));
  }
  topics.sort(
    (a, b) => b.due - a.due || b.slipping - a.slipping || b.learning - a.learning || b.words.length - a.words.length,
  );
  return [...groups, ...topics];
}

function summarize(id: string, label: string, hint: string, rows: Progress[], now: number): IslandGroup {
  let due = 0;
  let learning = 0;
  let fresh = 0;
  let known = 0;
  let slipping = 0;
  for (const row of rows) {
    if (row.failCount >= 2) slipping += 1;
    const band = wordBand(row, now);
    if (band === "due") due += 1;
    else if (band === "learning") learning += 1;
    else if (band === "new") fresh += 1;
    else known += 1;
  }
  return {
    id,
    label,
    hint,
    words: rows.map((row) => row.wordId),
    due,
    learning,
    fresh,
    known,
    slipping,
  };
}

export function readGroupId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const topic = value.slice(0, 48);
  if (!/^[\w:-]+$/.test(topic)) return undefined;
  return topic;
}
