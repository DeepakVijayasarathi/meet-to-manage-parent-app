import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOp, applySlideOp, emptyBoard, isSlideMarkOp, parseOp, strokeUpdate, toPixels, type Stroke } from "./board.ts";

const pen = (id: string, points: { x: number; y: number }[]): Stroke => ({ id, tool: "pen", points, color: "#000", width: 4 });

test("a stroke then its appends grow the same stroke, like the web", () => {
  let s = applyOp(emptyBoard(), { kind: "stroke", pageIndex: 0, stroke: pen("a", [{ x: 0, y: 0 }]) });
  s = applyOp(s, { kind: "strokeAppend", pageIndex: 0, strokeId: "a", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] });
  assert.equal(s.pages[0].strokes.length, 1);
  assert.equal(s.pages[0].strokes[0].points.length, 3);
});

test("re-sent strokes are upserted, appends before the stroke are dropped", () => {
  let s = applyOp(emptyBoard(), { kind: "strokeAppend", pageIndex: 0, strokeId: "x", points: [{ x: 1, y: 1 }] });
  assert.equal(s.pages[0].strokes.length, 0);
  s = applyOp(s, { kind: "stroke", pageIndex: 0, stroke: pen("x", [{ x: 0, y: 0 }]) });
  s = applyOp(s, { kind: "stroke", pageIndex: 0, stroke: pen("x", [{ x: 5, y: 5 }]) });
  assert.equal(s.pages[0].strokes.length, 1);
  assert.deepEqual(s.pages[0].strokes[0].points, [{ x: 5, y: 5 }]);
});

test("ops for unknown pages pad, navigation clamps, reset empties", () => {
  let s = applyOp(emptyBoard(), { kind: "stroke", pageIndex: 2, stroke: pen("p", [{ x: 0, y: 0 }]) });
  assert.equal(s.pages.length, 3);
  s = applyOp(s, { kind: "goToPage", pageIndex: 9 });
  assert.equal(s.pageIndex, 2);
  s = applyOp(s, { kind: "removePage", pageIndex: 2 });
  assert.equal(s.pages.length, 2);
  assert.equal(s.pageIndex, 1);
  s = applyOp(s, { kind: "reset" });
  assert.equal(s.pages.length, 1);
});

test("in-progress pen strokes send whole once, then only new points; shapes always whole", () => {
  const stroke = pen("s", [{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  const first = strokeUpdate(stroke, 0, 0, false);
  assert.equal(first.op?.kind, "stroke");
  stroke.points.push({ x: 2, y: 2 });
  const next = strokeUpdate(stroke, 0, first.sentCount, first.established);
  assert.equal(next.op?.kind, "strokeAppend");
  assert.deepEqual(next.op && "points" in next.op ? next.op.points : null, [{ x: 2, y: 2 }]);
  const rect: Stroke = { id: "r", tool: "rectangle", points: [{ x: 0, y: 0 }, { x: 3, y: 3 }], color: "#000", width: 2 };
  assert.equal(strokeUpdate(rect, 0, 2, true).op?.kind, "stroke");
});

test("slide marks: upsert, append, undo, clear and a new deck wipes all", () => {
  const mark = { ...pen("m", [{ x: 0.1, y: 0.1 }]) };
  let m = applySlideOp({}, { kind: "slideStroke", slide: 2, stroke: mark });
  m = applySlideOp(m, { kind: "slideStrokeAppend", slide: 2, strokeId: "m", points: [{ x: 0.2, y: 0.2 }] });
  assert.equal(m[2][0].points.length, 2);
  m = applySlideOp(m, { kind: "slideUndo", slide: 2, strokeId: "m" });
  assert.equal(m[2].length, 0);
  m = applySlideOp(m, { kind: "slideStroke", slide: 0, stroke: mark });
  assert.deepEqual(applySlideOp(m, { kind: "slideClearAll" }), {});
  assert.equal(isSlideMarkOp({ kind: "slideClear" }), true);
  assert.equal(isSlideMarkOp({ kind: "stroke" }), false);
  assert.deepEqual(toPixels(mark, 200, 100).points[0], { x: 20, y: 10 });
});

test("malformed hub payloads are ignored", () => {
  assert.equal(parseOp("not json"), null);
  assert.equal(parseOp("{}"), null);
  assert.equal(parseOp('{"kind":"clear","pageIndex":0}')?.kind, "clear");
});
