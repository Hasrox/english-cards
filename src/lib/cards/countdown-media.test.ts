import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { ART_ENABLED, BEAT_ART } from "./countdown-media.ts";

const BEATS = ["ready", "3", "2", "1", "go"] as const;

describe("countdown media map", () => {
  it("covers every beat, and nothing else", () => {
    // Order is asserted against BEATS, not Object.keys: "3"/"2"/"1" are
    // integer-like keys, so JS always enumerates them before "ready"/"go".
    assert.deepEqual(Object.keys(BEAT_ART).sort(), [...BEATS].sort());
    for (const beat of BEATS) {
      assert.ok(beat in BEAT_ART, `missing art for beat ${beat}`);
    }
  });

  it("gives each beat a non-empty text fallback", () => {
    for (const beat of BEATS) {
      assert.ok(BEAT_ART[beat].text.length > 0, `${beat} has no text fallback`);
    }
  });

  it("keeps the get-ready label and START! from the original countdown", () => {
    assert.equal(BEAT_ART.ready.text, "Get ready");
    assert.equal(BEAT_ART.go.text, "START!");
  });

  it("points webm, webp and still at distinct files under /videos", () => {
    for (const beat of BEATS) {
      const art = BEAT_ART[beat];
      for (const url of [art.webm, art.webp, art.still]) {
        assert.ok(url.startsWith("/videos/"), `${beat}: ${url} is not under /videos/`);
        assert.ok(url.endsWith(".webm") || url.endsWith(".webp") || url.endsWith(".png"));
      }
      assert.equal(new Set([art.webm, art.webp, art.still]).size, 3, `${beat} reuses a file`);
    }
  });

  it("uses webm and webp extensions so the format matches the element", () => {
    for (const beat of BEATS) {
      assert.ok(BEAT_ART[beat].webm.endsWith(".webm"));
      assert.ok(BEAT_ART[beat].webp.endsWith(".webp"));
    }
  });

  // Armed for the device test: the clips are opaque with a baked-in
  // checkerboard, but we want to confirm they actually play on the phone
  // before commissioning real alpha renders.
  it("is armed for the device test", () => {
    assert.equal(ART_ENABLED, true);
  });

  // Every URL the map points at must exist on disk, or the overlay burns
  // through the whole fallback chain on every beat before landing on text.
  it("resolves every referenced file to a real file", () => {
    for (const beat of BEATS) {
      const art = BEAT_ART[beat];
      for (const url of [art.webm, art.webp, art.still]) {
        const path = join("public", url.replace(/^\//, ""));
        assert.ok(existsSync(path), `${beat}: missing ${path}`);
        assert.ok(statSync(path).size > 0, `${beat}: empty ${path}`);
      }
    }
  });
});