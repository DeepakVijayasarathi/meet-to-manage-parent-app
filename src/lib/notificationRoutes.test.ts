import assert from "node:assert/strict";
import test from "node:test";

import { routeForTarget } from "./notificationRoutes.ts";

test("notification targets open the matching screen", () => {
  assert.equal(routeForTarget("homework", "a1"), "/homework");
  assert.equal(routeForTarget("invoice"), "/fees");
  assert.equal(routeForTarget("ticket", "t9"), "/support/t9");
  assert.equal(routeForTarget("class"), "/classes");
  assert.equal(routeForTarget("report", "r1"), "/reports/r1");
  assert.equal(routeForTarget("certificate", "c1"), "/certificates");
});

test("unknown or missing targets go nowhere", () => {
  assert.equal(routeForTarget(null), null);
  assert.equal(routeForTarget("something-new"), null);
});
