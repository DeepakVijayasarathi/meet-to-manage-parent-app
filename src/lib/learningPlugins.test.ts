import { test } from "node:test";
import assert from "node:assert/strict";
import { LEARNING_PLUGINS, normalizeH5pUrl, pluginGame } from "./learningPlugins.ts";

test("plugin ids match the web catalogue's scheme", () => {
  assert.equal(LEARNING_PLUGINS[0].id, "lp-1-1");
  assert.equal(LEARNING_PLUGINS[0].name, "Phonics Training");
  assert.ok(LEARNING_PLUGINS.length > 100);
  assert.equal(new Set(LEARNING_PLUGINS.map((p) => p.id)).size, LEARNING_PLUGINS.length);
});

test("plugins open the same mini-game as the web", () => {
  const byName = (n: string) => LEARNING_PLUGINS.find((p) => p.name === n)!;
  assert.equal(pluginGame(byName("Phonics Training")), "phonics");
  assert.equal(pluginGame(byName("Abacus")), "abacus");
  assert.equal(pluginGame(byName("Origami")), "challenge");
});

test("only https H5P links load, always as their embed URL", () => {
  assert.equal(normalizeH5pUrl("https://h5p.org/content/123"), "https://h5p.org/content/123/embed");
  assert.equal(normalizeH5pUrl("https://h5p.org/content/123/embed"), "https://h5p.org/content/123/embed");
  assert.equal(normalizeH5pUrl("http://h5p.org/content/123"), "");
  assert.equal(normalizeH5pUrl("javascript:alert(1)"), "");
});
