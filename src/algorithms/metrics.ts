import type { Attempt, Baseline, Result } from "../types";
export const VERSION = "premind-descriptive-1.0";
export const mean = (v: number[]) =>
  v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
export const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length
    ? (s[Math.floor(s.length / 2)] + s[Math.floor((s.length - 1) / 2)]) / 2
    : 0;
};
export const sd = (v: number[]) =>
  v.length > 1
    ? Math.sqrt(v.reduce((s, x) => s + (x - mean(v)) ** 2, 0) / (v.length - 1))
    : 0;
export function metrics(attempts: Attempt[]) {
  const valid = attempts.filter((a) => !a.premature);
  const times = valid
    .filter((a) => a.correct && a.rt !== null)
    .map((a) => a.rt!);
  return {
    mean: mean(times),
    median: median(times),
    variability: sd(times),
    accuracy: valid.length
      ? (100 * valid.filter((a) => a.correct).length) / valid.length
      : 0,
    errors: valid.filter((a) => !a.correct).length,
    premature: attempts.filter((a) => a.premature).length,
    omissions: valid.filter(
      (a) => !a.correct && a.rt === null && a.condition !== "nogo",
    ).length,
    count: valid.length,
    timedCount: times.length,
    stroopCost:
      valid.some(
        (a) => a.correct && a.rt !== null && a.condition === "conflict",
      ) &&
      valid.some(
        (a) => a.correct && a.rt !== null && a.condition === "congruent",
      )
        ? mean(
            valid
              .filter(
                (a) => a.correct && a.rt !== null && a.condition === "conflict",
              )
              .map((a) => a.rt!),
          ) -
          mean(
            valid
              .filter(
                (a) =>
                  a.correct && a.rt !== null && a.condition === "congruent",
              )
              .map((a) => a.rt!),
          )
        : null,
  };
}
export function baseline(results: Result[], current: Result): Baseline | null {
  const previous = results
    .filter(
      (r) =>
        r.test === current.test &&
        r.participantId === current.participantId &&
        r.device === current.device &&
        (current.test !== "memory" ||
          r.attempts.find((a) => a.condition?.startsWith("recall-"))
            ?.condition ===
            current.attempts.find((a) => a.condition?.startsWith("recall-"))
              ?.condition) &&
        Date.parse(r.timestamp) < Date.parse(current.timestamp),
    )
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .slice(0, 3);
  if (previous.length < 3) return null;
  const ms = previous.map((r) => metrics(r.attempts));
  return {
    mean: mean(ms.filter((m) => m.timedCount > 0).map((m) => m.mean)),
    accuracy: mean(ms.map((m) => m.accuracy)),
    variability: mean(
      ms.filter((m) => m.timedCount > 1).map((m) => m.variability),
    ),
    count: 3,
  };
}
export function change(result: Result, results: Result[], threshold = 20) {
  const b = baseline(results, result),
    m = metrics(result.attempts);
  if (!b) return null;
  const reaction =
    b.mean && m.timedCount ? (100 * (m.mean - b.mean)) / b.mean : null;
  return {
    reaction,
    variability:
      b.variability && m.timedCount > 1
        ? (100 * (m.variability - b.variability)) / b.variability
        : null,
    accuracy: m.accuracy - b.accuracy,
    decline:
      (reaction !== null && reaction >= threshold) ||
      b.accuracy - m.accuracy >= 10,
  };
}
export function correlation(x: number[], y: number[]) {
  if (x.length !== y.length || x.length < 3) return null;
  const mx = mean(x),
    my = mean(y),
    den = Math.sqrt(
      x.reduce((s, v) => s + (v - mx) ** 2, 0) *
        y.reduce((s, v) => s + (v - my) ** 2, 0),
    );
  return den
    ? x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / den
    : null;
}
