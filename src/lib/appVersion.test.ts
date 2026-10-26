import assert from "node:assert/strict";
import test from "node:test";

import { isOlderVersion } from "./appVersion.ts";

test("app versions compare numerically and tolerate missing segments", () => {
  assert.equal(isOlderVersion("1.9.0", "1.10.0"), true);
  assert.equal(isOlderVersion("2.0", "2.0.0"), false);
  assert.equal(isOlderVersion("2.1.0", "2.0.9"), false);
});

test("invalid version segments are treated as zero without crashing", () => {
  assert.equal(isOlderVersion("1.beta", "1.0.1"), true);
});
