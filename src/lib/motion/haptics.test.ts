import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HAPTIC_PATTERNS, buzz, haptics } from "./haptics.ts";

describe("HAPTIC_PATTERNS", () => {
  it("matches the PRD FR-4.2 patterns exactly", () => {
    assert.deepEqual(HAPTIC_PATTERNS, {
      tap: 10,
      correct: 15,
      wrong: [0, 40, 40, 40],
      celebrate: [0, 30, 60, 30, 120],
    });
  });
});

describe("buzz", () => {
  it("fires the exact array pattern through an injected vibrate", () => {
    const fired: Array<number | number[]> = [];
    assert.equal(
      buzz("wrong", (pattern) => {
        fired.push(pattern);
      }),
      true,
    );
    assert.deepEqual(fired, [[0, 40, 40, 40]]);
  });

  it("fires scalar patterns as plain numbers", () => {
    const fired: Array<number | number[]> = [];
    assert.equal(
      buzz("correct", (pattern) => {
        fired.push(pattern);
      }),
      true,
    );
    assert.deepEqual(fired, [15]);
  });

  it("returns false without throwing when no Vibration API exists", () => {
    // Node exposes `navigator` but not `vibrate` — the default path no-ops.
    assert.equal(buzz("tap"), false);
  });

  it("returns false when the platform throws (blocked vibration)", () => {
    assert.equal(
      buzz("celebrate", () => {
        throw new Error("not allowed");
      }),
      false,
    );
  });
});

describe("haptics", () => {
  it("exposes tap/correct/wrong/celebrate as non-throwing no-ops off-device", () => {
    const results = [haptics.tap(), haptics.correct(), haptics.wrong(), haptics.celebrate()];
    assert.deepEqual(results, [false, false, false, false]);
  });
});
