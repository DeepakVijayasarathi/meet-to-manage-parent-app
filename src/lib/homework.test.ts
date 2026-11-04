import assert from "node:assert/strict";
import test from "node:test";

import type { ApiFamilyAssignment } from "../api/types";
import { homeworkBucket } from "./homework.ts";

const base: ApiFamilyAssignment = {
  assignmentId: "a", submissionId: "s", childId: "c", childName: "Asha Kid", batchName: "Phonics A", courseName: null, teacherName: null,
  kind: "Homework", title: "Sheet", instructions: null, topic: null, attachmentFileName: null, dueAtUtc: null, maxMarks: null,
  status: "Pending", answerText: null, submissionFileName: null, submittedAtUtc: null, isOverdue: false, marks: null, feedback: null,
  resultsReleased: false, classAverage: null, canSubmit: true,
};

test("homework moves from to-do to handed in to results", () => {
  assert.equal(homeworkBucket(base), "todo");
  assert.equal(homeworkBucket({ ...base, status: "Submitted" }), "done");
  assert.equal(homeworkBucket({ ...base, status: "Graded", marks: 8 }), "results");
  assert.equal(homeworkBucket({ ...base, status: "Excused" }), "results");
});

test("an unreleased test stays in to-do; a released one shows in results", () => {
  assert.equal(homeworkBucket({ ...base, kind: "Test", status: "Pending" }), "todo");
  assert.equal(homeworkBucket({ ...base, kind: "Test", status: "Graded", marks: 15, resultsReleased: true }), "results");
});
