import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptySavedCard } from "./fsrs.ts";
import { practicePinnedIds } from "./practice-queue.ts";
import type { Progress } from "./types.ts";

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);

function row(wordId: string, state: number, extra: Partial<Progress> = {}): Progress {
  const card = emptySavedCard(NOW);
  card.state = state;
  return {
    wordId,
    card,
    arabic: null,
    hasPicture: false,
    credit: null,
    retired: false,
    failCount: 0,
    introducedOn: state === 0 ? null : "2026-06-15",
    pictureRev: 0,
    ...extra,
  };
}

describe("practicePinnedIds", () => {
  it("keeps the Learn batch order and drops New, retired, and missing ids", () => {
    const progress: Record<string, Progress> = {
      apple: row("apple", 1),
      bread: row("bread", 0),
      cat: row("cat", 2, { retired: true }),
      dog: row("dog", 2),
    };
    assert.deepEqual(practicePinnedIds(progress, ["apple", "bread", "cat", "missing", "dog"]), [
      "apple",
      "dog",
    ]);
  });

  it("does not pad with other introduced cards", () => {
    const progress: Record<string, Progress> = {
      apple: row("apple", 1),
      extra: row("extra", 2),
    };
    assert.deepEqual(practicePinnedIds(progress, ["apple"]), ["apple"]);
  });

  it("rotates inside the pinned list on later rounds", () => {
    const progress: Record<string, Progress> = {
      apple: row("apple", 1),
      bread: row("bread", 1),
      cat: row("cat", 1),
    };
    const ids = ["apple", "bread", "cat"];
    assert.deepEqual(practicePinnedIds(progress, ids, 0), ["apple", "bread", "cat"]);
    assert.deepEqual(practicePinnedIds(progress, ids, 1), ["cat", "apple", "bread"]);
  });
});
