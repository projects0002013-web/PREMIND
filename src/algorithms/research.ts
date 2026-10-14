import type { Experiment, ResearchSession, Result } from "../types";
import { metrics } from "./metrics";
export function researchOrder(
  experiment: Experiment,
  session: ResearchSession,
  results: Result[],
) {
  const primary = results
    .filter((r) => r.sessionId === session.id && r.test === experiment.tests[0])
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  if (primary.length < 2)
    return {
      status: "insufficient" as const,
      objectivePoint: null,
      subjectivePoint: null,
    };
  const first = metrics(primary[0].attempts);
  const changed = primary.findIndex((r, i) => {
    const m = metrics(r.attempts);
    return (
      i > 0 &&
      ((first.mean > 0 &&
        m.timedCount > 0 &&
        m.mean >= first.mean * (1 + experiment.threshold / 100)) ||
        first.accuracy - m.accuracy >= 10)
    );
  });
  const objectivePoint =
    changed > 0 ? (primary[changed].point ?? changed + 1) : null;
  const initial = session.assessments.find((a) => a.point === 0)?.values
    .concentration;
  const subjectivePoint =
    initial === undefined
      ? null
      : ([...session.assessments]
          .sort((a, b) => a.point - b.point)
          .find((a) => a.point > 0 && a.values.concentration - initial >= 2)
          ?.point ?? null);
  return {
    status:
      objectivePoint === null || subjectivePoint === null
        ? ("undetermined" as const)
        : objectivePoint < subjectivePoint
          ? ("earlier" as const)
          : ("not-earlier" as const),
    objectivePoint,
    subjectivePoint,
  };
}
