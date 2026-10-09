import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CONSENT_SHIM, HARVEST_SHIM, consentShim, harvestShim } from "./picture-shim.mjs";

describe("picture-shim", () => {
  it("exports injectable IIFEs that wrap the harvest functions", () => {
    assert.equal(typeof consentShim, "function");
    assert.equal(typeof harvestShim, "function");
    assert.match(CONSENT_SHIM, /^\(function consentShim\(\)/);
    assert.match(HARVEST_SHIM, /^\(function harvestShim\(\)/);
    assert.match(HARVEST_SHIM, /encrypted-tbn/);
    assert.match(HARVEST_SHIM, /unusual traffic/);
    assert.match(HARVEST_SHIM, /recaptcha/);
  });
});
