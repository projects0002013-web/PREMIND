import { describe, it, expect } from "vitest";
import {
  metrics,
  mean,
  median,
  sd,
  baseline,
  change,
  correlation,
} from "../algorithms/metrics";
import { validate, initial, csv } from "../storage/db";
import type { Result, Attempt } from "../types";
const a = (rt: number | null, correct = true, index = 0): Attempt => ({
  id: crypto.randomUUID(),
  rt,
  correct,
  index,
});
const result = (i: number, times = [200, 300]): Result => ({
  id: crypto.randomUUID(),
  participantId: "p",
  sessionId: "s",
  device: "d",
  test: "reaction",
  timestamp: `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
  algorithmVersion: "1",
  attempts: times.map((rt, index) => a(rt, true, index)),
});
describe("descriptive statistics", () => {
  it("calculates mean, median and sample standard deviation", () => {
    expect(mean([100, 200, 300])).toBe(200);
    expect(median([5, 1, 4, 2])).toBe(3);
    expect(sd([100, 200, 300])).toBe(100);
  });
  it("separates early presses, errors, omissions and correct inhibition", () => {
    const m = metrics([
      a(200),
      a(400),
      a(null, false),
      { ...a(null, false), premature: true },
      { ...a(null), condition: "nogo" },
    ]);
    expect(m.mean).toBe(300);
    expect(m.accuracy).toBe(75);
    expect(m.errors).toBe(1);
    expect(m.omissions).toBe(1);
    expect(m.premature).toBe(1);
    expect(m.timedCount).toBe(2);
  });
  it("does not fabricate timed data", () => {
    expect(metrics([a(null, false)]).timedCount).toBe(0);
  });
  it("calculates Stroop interference only from correct timed trials", () => {
    expect(
      metrics([
        { ...a(200), condition: "congruent" },
        { ...a(350), condition: "conflict" },
      ]).stroopCost,
    ).toBe(150);
  });
});
describe("baseline and leakage prevention", () => {
  it("requires 3 prior same-participant, same-device, same-test results", () => {
    const r = result(3);
    expect(baseline([result(0), result(1)], r)).toBeNull();
    expect(
      baseline([result(0), result(1), { ...result(2), device: "other" }], r),
    ).toBeNull();
    expect(
      baseline([result(0), result(1), { ...result(2), test: "stroop" }], r),
    ).toBeNull();
  });
  it("excludes future/current data and detects predefined decline", () => {
    const r = result(3, [400, 500]);
    const prior = [result(0), result(1), result(2)];
    expect(baseline([...prior, r, result(4, [9000])], r)?.mean).toBe(250);
    expect(change(r, prior)?.decline).toBe(true);
    expect(change(r, prior)?.reaction).toBe(80);
  });
  it("avoids undefined correlation", () => {
    expect(correlation([1, 2], [2, 3])).toBeNull();
    expect(correlation([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  });
});
describe("backup boundary", () => {
  it("round-trips valid data and raw trial CSV", () => {
    const d = { ...initial(), results: [result(0)] };
    expect(validate(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(csv(d)).toContain("rt_ms");
    expect(csv(d)).toContain('"200"');
  });
  it("rejects invalid version, negative timing and duplicate record IDs", () => {
    expect(() => validate({ schemaVersion: 2 })).toThrow();
    const r = result(0);
    expect(() =>
      validate({ ...initial(), results: [{ ...r, attempts: [a(-1)] }] }),
    ).toThrow();
    expect(() => validate({ ...initial(), results: [r, r] })).toThrow();
  });
});
