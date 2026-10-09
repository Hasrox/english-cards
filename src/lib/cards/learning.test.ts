import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  advanceLearnGotIt,
  advanceMatchBoard,
  advanceSpellCorrect,
  advanceTypeCorrect,
  createLearnSession,
  currentBatchWordId,
  introduceRating,
  learningBatch,
  learnStageProgress,
  learnStageTitle,
  matchBoards,
  matchMode,
  matchesLearnTopic,
  noteSpellRetry,
  noteTypeRetry,
  ratingForWord,
  spellDiff,
  spellPuzzle,
  typeCheck,
  type LearnLookup,
  type LearnWordInfo,
} from "./learning.ts";
import { emptySavedCard } from "./fsrs.ts";
import { dayKey } from "./time.ts";
import type { Progress, Settings } from "./types.ts";

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);

function word(
  id: string,
  opts: Partial<LearnWordInfo> & Pick<LearnWordInfo, "lemma" | "rank" | "topic">,
): LearnWordInfo {
  return {
    id,
    lemma: opts.lemma,
    rank: opts.rank,
    topic: opts.topic,
    pos: opts.pos ?? "noun",
    ar: opts.ar ?? `ع-${opts.lemma}`,
  };
}

const CATALOG: Record<string, LearnWordInfo> = {
  apple: word("apple", { lemma: "apple", rank: 10, topic: "food" }),
  bread: word("bread", { lemma: "bread", rank: 20, topic: "food" }),
  cat: word("cat", { lemma: "cat", rank: 30, topic: "animals" }),
  dog: word("dog", { lemma: "dog", rank: 40, topic: "animals" }),
  egg: word("egg", { lemma: "egg", rank: 50, topic: "food" }),
  fish: word("fish", { lemma: "fish", rank: 60, topic: "animals" }),
  grape: word("grape", { lemma: "grape", rank: 70, topic: "food" }),
  hat: word("hat", { lemma: "hat", rank: 80, topic: "home" }),
  milk: word("milk", { lemma: "milk", rank: 5, topic: "food" }),
  water: word("water", { lemma: "water", rank: 6, topic: "food" }),
  bird: word("bird", { lemma: "bird", rank: 7, topic: "animals" }),
  the: word("the", { lemma: "the", rank: 1, topic: "language", pos: "determiner", ar: "ال" }),
};

const lookup: LearnLookup = (id) => CATALOG[id];

function progressRow(
  wordId: string,
  opts: {
    state?: number;
    retired?: boolean;
    introducedOn?: string | null;
    hasPicture?: boolean;
    arabic?: string | null;
    failCount?: number;
  } = {},
): Progress {
  const card = emptySavedCard(NOW);
  card.state = opts.state ?? 0;
  return {
    wordId,
    card,
    arabic: opts.arabic ?? null,
    hasPicture: opts.hasPicture ?? false,
    credit: null,
    retired: opts.retired ?? false,
    failCount: opts.failCount ?? 0,
    introducedOn: opts.introducedOn ?? null,
    pictureRev: 0,
  };
}

const settings = (newCap: number): Pick<Settings, "newCap"> => ({ newCap });

describe("learningBatch", () => {
  it("caps the batch by remaining daily newCap", () => {
    const today = dayKey(NOW);
    const progress: Record<string, Progress> = {
      apple: progressRow("apple"),
      bread: progressRow("bread"),
      cat: progressRow("cat"),
      dog: progressRow("dog"),
      milk: progressRow("milk", { state: 2, introducedOn: today }),
    };

    const batch = learningBatch(progress, settings(3), NOW, lookup);
    // room = 3 - 1 = 2; lowest ranks among new: apple(10), bread(20)
    assert.deepEqual(batch, ["apple", "bread"]);
  });

  it("returns only new, non-retired words sorted by rank", () => {
    const progress: Record<string, Progress> = {
      dog: progressRow("dog"),
      apple: progressRow("apple"),
      cat: progressRow("cat", { state: 2 }),
      bread: progressRow("bread", { retired: true }),
    };
    assert.deepEqual(learningBatch(progress, settings(10), NOW, lookup), ["apple", "dog"]);
  });

  it("filters by topic and returns [] when the topic has no new words", () => {
    const progress: Record<string, Progress> = {
      apple: progressRow("apple"),
      cat: progressRow("cat"),
      dog: progressRow("dog"),
    };
    assert.deepEqual(learningBatch(progress, settings(10), NOW, lookup, "food"), ["apple"]);
    assert.deepEqual(learningBatch(progress, settings(10), NOW, lookup, "study"), []);
  });

  it("supports top100 group membership via rank", () => {
    const progress: Record<string, Progress> = {
      the: progressRow("the"),
      apple: progressRow("apple"),
    };
    assert.deepEqual(learningBatch(progress, settings(10), NOW, lookup, "top100"), ["the", "apple"]);
  });

  it("returns [] when daily cap is already used", () => {
    const today = dayKey(NOW);
    const progress: Record<string, Progress> = {
      apple: progressRow("apple"),
      milk: progressRow("milk", { state: 2, introducedOn: today }),
      water: progressRow("water", { state: 2, introducedOn: today }),
    };
    assert.deepEqual(learningBatch(progress, settings(2), NOW, lookup), []);
  });
});

describe("matchesLearnTopic", () => {
  it("matches topic:pos suffixes", () => {
    assert.equal(matchesLearnTopic(CATALOG.the!, "language:determiner"), true);
    assert.equal(matchesLearnTopic(CATALOG.the!, "language:noun"), false);
    assert.equal(matchesLearnTopic(CATALOG.apple!, "food"), true);
  });
});

describe("matchMode", () => {
  it("uses picture when hasPicture is true, else en-ar", () => {
    assert.equal(matchMode({ hasPicture: true }), "picture");
    assert.equal(matchMode({ hasPicture: false }), "en-ar");
  });
});

describe("matchBoards", () => {
  it("builds boards of at most 4 pairs with known fillers", () => {
    const progress: Record<string, Progress> = {
      apple: progressRow("apple", { hasPicture: true }),
      bread: progressRow("bread"),
      egg: progressRow("egg"),
      grape: progressRow("grape"),
      milk: progressRow("milk", { state: 2 }),
      water: progressRow("water", { state: 2 }),
      bird: progressRow("bird", { state: 2 }),
    };
    const boards = matchBoards(["apple", "bread", "egg", "grape"], progress, lookup, {
      fillerCount: 3,
      boardSize: 4,
      salt: 1,
    });
    const all = boards.flatMap((b) => b.pairs);
    assert.ok(boards.length >= 2);
    assert.ok(boards.every((b) => b.pairs.length <= 4));
    assert.equal(all.filter((p) => p.isTarget).length, 4);
    assert.equal(all.filter((p) => !p.isTarget).length, 3);
    assert.equal(all.find((p) => p.wordId === "apple")?.mode, "picture");
    assert.equal(all.find((p) => p.wordId === "bread")?.mode, "en-ar");
  });

  it("returns [] for an empty batch", () => {
    assert.deepEqual(matchBoards([], {}, lookup), []);
  });
});

describe("spellPuzzle", () => {
  it("keeps first and last letters and gaps middles on long words", () => {
    const puzzle = spellPuzzle("apple", 0);
    assert.equal(puzzle.cells[0]?.char, "a");
    assert.equal(puzzle.cells[0]?.gap, false);
    assert.equal(puzzle.cells[4]?.char, "e");
    assert.equal(puzzle.cells[4]?.gap, false);
    assert.deepEqual(
      puzzle.cells.slice(1, 4).map((c) => c.gap),
      [true, true, true],
    );
    assert.deepEqual(puzzle.answers, ["p", "p", "l"]);
    for (const letter of puzzle.answers) {
      assert.ok(puzzle.tiles.filter((t) => t === letter).length >= 1, `missing tile ${letter}`);
    }
    // both p's must appear
    assert.equal(puzzle.tiles.filter((t) => t === "p").length, 2);
    assert.ok(puzzle.tiles.length > puzzle.answers.length, "adds distractors");
  });

  it("gaps the only letter on single-letter lemmas", () => {
    const puzzle = spellPuzzle("a", 0);
    assert.deepEqual(puzzle.cells, [{ char: "a", gap: true }]);
    assert.deepEqual(puzzle.answers, ["a"]);
  });

  it("gaps the second letter on two-letter lemmas", () => {
    const puzzle = spellPuzzle("be", 0);
    assert.deepEqual(puzzle.cells, [
      { char: "b", gap: false },
      { char: "e", gap: true },
    ]);
    assert.deepEqual(puzzle.answers, ["e"]);
  });
});

describe("spellDiff", () => {
  it("marks match / miss / missing / extra per letter", () => {
    assert.deepEqual(spellDiff("cat", "car"), [
      { expected: "c", got: "c", mark: "match" },
      { expected: "a", got: "a", mark: "match" },
      { expected: "t", got: "r", mark: "miss" },
    ]);
    assert.deepEqual(spellDiff("cat", "ca"), [
      { expected: "c", got: "c", mark: "match" },
      { expected: "a", got: "a", mark: "match" },
      { expected: "t", got: null, mark: "missing" },
    ]);
    assert.deepEqual(spellDiff("ca", "cat"), [
      { expected: "c", got: "c", mark: "match" },
      { expected: "a", got: "a", mark: "match" },
      { expected: null, got: "t", mark: "extra" },
    ]);
  });

  it("is case-insensitive and trims", () => {
    assert.deepEqual(spellDiff("Cat", " CAT "), [
      { expected: "c", got: "c", mark: "match" },
      { expected: "a", got: "a", mark: "match" },
      { expected: "t", got: "t", mark: "match" },
    ]);
  });
});

describe("typeCheck", () => {
  it("accepts case-insensitive exact matches only", () => {
    assert.equal(typeCheck("Apple", "apple"), true);
    assert.equal(typeCheck("apple", " apple "), true);
    assert.equal(typeCheck("apple", "aple"), false);
    assert.equal(typeCheck("apple", "apple!"), false);
  });
});

describe("introduceRating", () => {
  it("returns good only when spell and type were both clean", () => {
    assert.equal(introduceRating({ spellRetries: 0, typeRetries: 0 }), "good");
    assert.equal(introduceRating({ spellRetries: 1, typeRetries: 0 }), "hard");
    assert.equal(introduceRating({ spellRetries: 0, typeRetries: 2 }), "hard");
    assert.equal(introduceRating({ spellRetries: 3, typeRetries: 1 }), "hard");
  });
});

describe("createLearnSession / ratingForWord", () => {
  it("starts on learn and rates per-word retries", () => {
    const session = createLearnSession(["apple", "cat"]);
    assert.equal(session.stage, "learn");
    assert.equal(ratingForWord(session, "apple"), "good");
    session.results.apple!.spellRetries = 1;
    assert.equal(ratingForWord(session, "apple"), "hard");
    assert.equal(ratingForWord(session, "cat"), "good");
  });

  it("marks empty batch as done", () => {
    assert.equal(createLearnSession([]).stage, "done");
  });
});

describe("learn session state machine", () => {
  it("walks Learn → Match → Spell → Type → done (stage-batch)", () => {
    let session = createLearnSession(["apple", "cat"]);
    assert.equal(session.stage, "learn");
    assert.equal(currentBatchWordId(session), "apple");
    assert.deepEqual(learnStageProgress(session), { current: 1, total: 2 });
    assert.equal(learnStageTitle("learn"), "Learn it");

    session = advanceLearnGotIt(session, 2);
    assert.equal(currentBatchWordId(session), "cat");
    session = advanceLearnGotIt(session, 2);
    assert.equal(session.stage, "match");
    assert.equal(session.boardIndex, 0);
    assert.equal(currentBatchWordId(session), null);
    assert.deepEqual(learnStageProgress(session, 2), { current: 1, total: 2 });

    session = advanceMatchBoard(session, 2);
    assert.equal(session.stage, "match");
    assert.equal(session.boardIndex, 1);
    session = advanceMatchBoard(session, 2);
    assert.equal(session.stage, "spell");
    assert.equal(session.index, 0);
    assert.equal(currentBatchWordId(session), "apple");

    session = advanceSpellCorrect(session);
    assert.equal(currentBatchWordId(session), "cat");
    session = advanceSpellCorrect(session);
    assert.equal(session.stage, "type");
    assert.equal(session.index, 0);

    session = advanceTypeCorrect(session);
    assert.equal(currentBatchWordId(session), "cat");
    session = advanceTypeCorrect(session);
    assert.equal(session.stage, "done");
    // Phase 3: done means stages finished — no grade side effects here.
    assert.equal(ratingForWord(session, "apple"), "good");
    assert.equal(ratingForWord(session, "cat"), "good");
  });

  it("skips Match when there are no boards", () => {
    let session = createLearnSession(["apple"]);
    session = advanceLearnGotIt(session, 0);
    assert.equal(session.stage, "spell");
    assert.equal(session.index, 0);
  });

  it("skips Match immediately when boardCount is 0 mid-stage", () => {
    let session = createLearnSession(["apple"]);
    session = { ...session, stage: "match", boardIndex: 0 };
    session = advanceMatchBoard(session, 0);
    assert.equal(session.stage, "spell");
  });

  it("counts spell/type retries without advancing the cursor", () => {
    let session = createLearnSession(["apple", "cat"]);
    session = { ...session, stage: "spell", index: 0 };
    session = noteSpellRetry(session, "apple");
    session = noteSpellRetry(session, "apple");
    assert.equal(session.index, 0);
    assert.equal(session.results.apple!.spellRetries, 2);
    assert.equal(ratingForWord(session, "apple"), "hard");

    session = advanceSpellCorrect(session);
    assert.equal(session.index, 1);
    session = advanceSpellCorrect(session);
    assert.equal(session.stage, "type");

    session = noteTypeRetry(session, "apple");
    assert.equal(session.results.apple!.typeRetries, 1);
    assert.equal(session.index, 0);
    assert.equal(ratingForWord(session, "apple"), "hard");
    // unknown ids are ignored
    const before = session;
    session = noteTypeRetry(session, "missing");
    assert.equal(session, before);
  });

  it("ignores advance calls on the wrong stage", () => {
    const base = createLearnSession(["apple"]);
    assert.equal(advanceSpellCorrect(base).stage, "learn");
    assert.equal(advanceTypeCorrect(base).stage, "learn");
    assert.equal(advanceMatchBoard(base, 1).stage, "learn");
    const spell = { ...base, stage: "spell" as const };
    assert.equal(advanceLearnGotIt(spell, 1).stage, "spell");
  });
});
