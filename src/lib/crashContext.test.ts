import assert from "node:assert/strict";
import test from "node:test";

import { crashContext } from "./crashContext.ts";

test("crash context keeps short labels and collapses stacks", () => {
  assert.equal(crashContext("homework_photo"), "homework_photo");
  assert.equal(crashContext("\n    in Text (at index.tsx)\n    in View"), "render");
  assert.equal(crashContext(undefined), null);
  assert.equal(crashContext("x".repeat(80)), "render");
});
