import { openDB } from "idb";
import { testKinds, type Data } from "../types";
const db = () =>
  openDB("premind", 1, {
    upgrade(db) {
      db.createObjectStore("state");
    },
  });
export const initial = (): Data => ({
  schemaVersion: 1,
  participant: {
    id: crypto.randomUUID(),
    consent: false,
    guardianConsent: false,
  },
  participants: [],
  results: [],
  experiments: [],
  sessions: [],
});
export async function load() {
  const d =
    ((await (await db()).get("state", "data")) as Data | undefined) ??
    initial();
  return { ...d, participants: d.participants ?? [] };
}
export async function save(data: Data) {
  await (await db()).put("state", data, "data");
}
export function validate(value: unknown): Data {
  const d = value as Data;
  if (
    !d ||
    d.schemaVersion !== 1 ||
    !d.participant ||
    typeof d.participant.id !== "string" ||
    typeof d.participant.consent !== "boolean" ||
    typeof d.participant.guardianConsent !== "boolean" ||
    !Array.isArray(d.results) ||
    !Array.isArray(d.experiments) ||
    !Array.isArray(d.sessions)
  )
    throw Error("Invalid backup");
  if (d.participants === undefined) d.participants = [];
  if (
    !Array.isArray(d.participants) ||
    d.participants.some(
      (p) =>
        !p ||
        typeof p.id !== "string" ||
        typeof p.consent !== "boolean" ||
        typeof p.guardianConsent !== "boolean",
    ) ||
    new Set(d.participants.map((p) => p.id)).size !== d.participants.length
  )
    throw Error("Invalid participants");
  const ids = new Set<string>();
  const id = (v: unknown) => {
    if (typeof v !== "string" || !v || ids.has(v))
      throw Error("Invalid or duplicate ID");
    ids.add(v);
  };
  const date = (v: string) => {
    if (typeof v !== "string" || !Number.isFinite(Date.parse(v)))
      throw Error("Invalid timestamp");
  };
  const assessment = (a: any) => {
    if (
      !a ||
      !["fatigue", "concentration", "motivation"].every(
        (k) => Number.isFinite(a[k]) && a[k] >= 0 && a[k] <= 10,
      ) ||
      (a.sleep !== undefined &&
        (!Number.isFinite(a.sleep) || a.sleep < 0 || a.sleep > 24)) ||
      (a.distractions !== undefined && typeof a.distractions !== "string")
    )
      throw Error("Invalid assessment");
  };
  d.results.forEach((r) => {
    id(r.id);
    date(r.timestamp);
    if (
      !testKinds.includes(r.test) ||
      typeof r.participantId !== "string" ||
      typeof r.sessionId !== "string" ||
      typeof r.device !== "string" ||
      typeof r.algorithmVersion !== "string" ||
      !Array.isArray(r.attempts) ||
      !r.attempts.length ||
      (r.point !== undefined &&
        (!Number.isInteger(r.point) || r.point < 1 || r.point > 5))
    )
      throw Error("Invalid result");
    r.attempts.forEach((a) => {
      id(a.id);
      if (
        typeof a.correct !== "boolean" ||
        !Number.isInteger(a.index) ||
        a.index < 0 ||
        (a.premature !== undefined && typeof a.premature !== "boolean") ||
        (a.condition !== undefined && typeof a.condition !== "string") ||
        (a.rt !== null && (!Number.isFinite(a.rt) || a.rt < 0 || a.rt > 120000))
      )
        throw Error("Invalid attempt");
    });
    if (r.assessment) assessment(r.assessment);
  });
  d.experiments.forEach((e) => {
    id(e.id);
    date(e.createdAt);
    if (
      typeof e.name !== "string" ||
      typeof e.hypothesis !== "string" ||
      !Array.isArray(e.tests) ||
      !e.tests.length ||
      e.tests.some((t) => !testKinds.includes(t)) ||
      !Number.isInteger(e.points) ||
      e.points < 2 ||
      e.points > 5 ||
      !Number.isFinite(e.interval) ||
      e.interval < 10 ||
      e.interval > 300 ||
      !Number.isFinite(e.threshold) ||
      e.threshold < 5 ||
      e.threshold > 100
    )
      throw Error("Invalid experiment");
  });
  d.sessions.forEach((s) => {
    id(s.id);
    date(s.startedAt);
    if (s.completedAt) date(s.completedAt);
    if (
      !["active", "completed", "stopped"].includes(s.status) ||
      typeof s.participantId !== "string" ||
      !d.experiments.some((e) => e.id === s.experimentId) ||
      !Array.isArray(s.assessments)
    )
      throw Error("Invalid session");
    s.assessments.forEach((a) => {
      date(a.at);
      assessment(a.values);
      if (!Number.isInteger(a.point) || a.point < 0)
        throw Error("Invalid point");
    });
  });
  return d;
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const cell = (v: unknown) =>
  '"' +
  String(
    typeof v === "string" && /^[=+@-]/.test(v) ? "'" + v : (v ?? ""),
  ).replaceAll('"', '""') +
  '"';
export function csv(data: Data) {
  return [
    "participant,session,test,timestamp,attempt,rt_ms,correct,premature,condition,algorithm,point,fatigue_before,concentration_before,motivation_before,sleep_hours,fatigue_after,concentration_after,motivation_after",
    ...data.results.flatMap((r) =>
      r.attempts.map((a) =>
        [
          r.participantId,
          r.sessionId,
          r.test,
          r.timestamp,
          a.index,
          a.rt,
          a.correct,
          a.premature ?? false,
          a.condition,
          r.algorithmVersion,
          r.point,
          r.assessment?.fatigue,
          r.assessment?.concentration,
          r.assessment?.motivation,
          r.assessment?.sleep,
          data.sessions
            .find((s) => s.id === r.sessionId)
            ?.assessments.find((a) => a.point === r.point)?.values.fatigue,
          data.sessions
            .find((s) => s.id === r.sessionId)
            ?.assessments.find((a) => a.point === r.point)?.values
            .concentration,
          data.sessions
            .find((s) => s.id === r.sessionId)
            ?.assessments.find((a) => a.point === r.point)?.values.motivation,
        ]
          .map(cell)
          .join(","),
      ),
    ),
  ].join("\n");
}
