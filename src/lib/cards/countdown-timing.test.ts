import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BEAT_OFFSETS,
  GO_HOLD_MS,
  GO_MS,
  ONE_MS,
  OVERLAY_CLEAR_MS,
  START_OVERLAP_MS,
  THREE_MS,
  TWO_MS,
} from "./countdown-timing.ts";

// Measured from public/sounds/3-sec-countdown.mp3 with ffmpeg silencedetect
// plus an RMS envelope: silence to 1097 ms, then beeps 1019 ms apart.
const BEEP_1 = 1097;
const BEEP_2 = 2116;
const BEEP_3 = 3135;
const START_FLOURISH = 4153;

describe("countdown beat offsets", () => {
  it("puts each number on its own beep, not 1.1s early", () => {
    assert.equal(THREE_MS, BEEP_1);
    assert.equal(TWO_MS, BEEP_2);
    assert.equal(ONE_MS, BEEP_3);
  });

  // The original bug: beeps were scheduled at 0/1000/2000 while the file has a
  // ~1.1 s lead-in, so beep 1 landed while the screen already read "2".
  it("never schedules a beat before the audio's first beep", () => {
    for (const [beat, offset] of Object.entries(BEAT_OFFSETS)) {
      assert.ok(offset >= BEEP_1, `${beat} at ${offset}ms precedes beep 1 at ${BEEP_1}ms`);
    }
  });

  it("keeps the three numbers in schedule order", () => {
    assert.ok(THREE_MS < TWO_MS, "3 must precede 2");
    assert.ok(TWO_MS < ONE_MS, "2 must precede 1");
    assert.ok(ONE_MS < GO_MS, "1 must precede GO");
  });

  it("spaces the numbers at the audio's ~1019ms beep interval", () => {
    assert.equal(TWO_MS - THREE_MS, BEEP_2 - BEEP_1);
    assert.equal(ONE_MS - TWO_MS, BEEP_3 - BEEP_2);
  });

  // Owner decision: the question starts before the START flourish finishes,
  // rather than adding ~150ms of latency before the child sees the card.
  it("starts GO before the START flourish, and records the overlap", () => {
    assert.ok(GO_MS < START_FLOURISH, "GO must not wait for the flourish");
    assert.equal(START_OVERLAP_MS, START_FLOURISH - GO_MS);
  });

  it("holds the overlay for GO_HOLD_MS after GO", () => {
    assert.equal(OVERLAY_CLEAR_MS, GO_MS + GO_HOLD_MS);
  });
});