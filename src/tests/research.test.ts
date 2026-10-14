import { describe, it, expect } from "vitest";
import { researchOrder } from "../algorithms/research";
import { baseline, metrics } from "../algorithms/metrics";
import { initial, validate, csv } from "../storage/db";
import type { Experiment, ResearchSession, Result } from "../types";
const experiment: Experiment = {
  id: "e",
  name: "study",
  hypothesis: "h",
  tests: ["reaction"],
  points: 3,
  interval: 30,
  threshold: 20,
  createdAt: "2026-10-14T00:00:00Z",
};
const session = (values: number[]): ResearchSession => ({
  id: "s",
  participantId: "p",
  experimentId: "e",
  status: "completed",
  startedAt: experiment.createdAt,
  assessments: values.map((concentration, point) => ({
    at: experiment.createdAt,
    point,
    values: { concentration, fatigue: 0, motivation: 5 },
  })),
});
const result = (point: number, rt: number): Result => ({
  id: `r${point}`,
  point,
  participantId: "p",
  sessionId: "s",
  device: "d",
  test: "reaction",
  timestamp: `2026-10-14T00:0${point}:00Z`,
  algorithmVersion: "1",
  attempts: [{ id: `a${point}`, index: 0, rt, correct: true }],
});
describe("research ordering", () => {
  it("compares objective time points against post-series assessments without an off-by-one error", () => {
    const order = researchOrder(experiment, session([0, 0, 0, 2]), [
      result(1, 200),
      result(2, 260),
      result(3, 270),
    ]);
    expect(order).toEqual({
      status: "earlier",
      objectivePoint: 2,
      subjectivePoint: 3,
    });
  });
  it("does not claim precedence when both changes occur at point 2", () => {
    expect(
      researchOrder(experiment, session([0, 0, 2]), [
        result(1, 200),
        result(2, 260),
      ]).status,
    ).toBe("not-earlier");
  });
  it("distinguishes insufficient points from an unreached criterion", () => {
    expect(
      researchOrder(experiment, session([0, 0]), [result(1, 200)]).status,
    ).toBe("insufficient");
    expect(
      researchOrder(experiment, session([0, 0, 0]), [
        result(1, 200),
        result(2, 210),
      ]).status,
    ).toBe("undetermined");
  });
  it("does not use another session’s data or the wrong primary test", () => {
    expect(
      researchOrder(experiment, session([0, 0, 2]), [
        result(1, 200),
        { ...result(2, 900), sessionId: "other" },
      ]).status,
    ).toBe("insufficient");
  });
});
describe("data quality", () => {
  it("does not report Stroop cost with one missing condition", () => {
    expect(
      metrics([
        { id: "a", index: 0, rt: 200, correct: true, condition: "conflict" },
      ]).stroopCost,
    ).toBeNull();
  });
  it("does not treat missing timed trials as zero milliseconds in baseline", () => {
    const missing = {
      ...result(2, 0),
      attempts: [{ id: "b", index: 0, rt: null, correct: false }],
    };
    expect(
      baseline([result(1, 200), missing, result(3, 300)], result(4, 300))?.mean,
    ).toBe(250);
  });
  it("rejects invalid optional attempt metadata", () => {
    expect(() =>
      validate({
        ...initial(),
        results: [
          {
            ...result(1, 200),
            attempts: [
              { id: "a", index: 0, rt: 200, correct: true, condition: {} },
            ],
          },
        ],
      }),
    ).toThrow();
  });
  it("exports both before and after series subjective ratings", () => {
    const s = session([0, 1]);
    const r = {
      ...result(1, 200),
      assessment: { fatigue: 0, concentration: 0, motivation: 5 },
    };
    const text = csv({ ...initial(), sessions: [s], results: [r] });
    expect(text).toContain("concentration_after");
    expect(text.split("\n")[1].endsWith('"0","1","5"')).toBe(true);
  });
});
