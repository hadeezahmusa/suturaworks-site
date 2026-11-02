import { test } from "node:test";
import assert from "node:assert/strict";
import { planTasks } from "../src/sprintpack.js";

const TASKS = ["T1", "T2", "T3", "T4", "T5", "T6"];
// In the handover chain each table hands to the next, the last to the first.
const clashes = (plan) => plan.filter((t, i) => plan.length > 1 && t === plan[(i + 1) % plan.length]).length;

test("six tables get T1 to T6 in order", () => {
  assert.deepEqual(planTasks([0, 1, 2, 3, 4, 5], TASKS), TASKS);
});

test("no table and the table it hands to share a task, from 2 to 13 tables", () => {
  for (let n = 2; n <= 13; n++) {
    const plan = planTasks(Array.from({ length: n }, (_, i) => i), TASKS);
    assert.equal(plan.length, n);
    assert.equal(clashes(plan), 0, `${n} tables: ${plan.join(" ")}`);
  }
});

test("tasks are spread evenly", () => {
  const plan = planTasks(Array.from({ length: 9 }, (_, i) => i), TASKS);
  const counts = TASKS.map((t) => plan.filter((x) => x === t).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, counts.join(","));
});

test("seven tables do not end on T1 next to Foundation's T1", () => {
  const plan = planTasks([0, 1, 2, 3, 4, 5, 6], TASKS);
  assert.notEqual(plan[6], plan[0]);
});
