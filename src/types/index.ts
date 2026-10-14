export const testKinds = [
  "reaction",
  "stroop",
  "attention",
  "memory",
  "search",
] as const;
export type TestKind = (typeof testKinds)[number];
export interface Attempt {
  id: string;
  rt: number | null;
  correct: boolean;
  premature?: boolean;
  condition?: string;
  index: number;
}
export interface Assessment {
  fatigue: number;
  concentration: number;
  motivation: number;
  sleep?: number;
  distractions?: string;
}
export interface Result {
  id: string;
  participantId: string;
  sessionId: string;
  test: TestKind;
  timestamp: string;
  algorithmVersion: string;
  attempts: Attempt[];
  device: string;
  assessment?: Assessment;
  point?: number;
}
export interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  tests: TestKind[];
  points: number;
  interval: number;
  threshold: number;
  createdAt: string;
}
export interface ResearchSession {
  id: string;
  experimentId: string;
  participantId: string;
  startedAt: string;
  completedAt?: string;
  status: "active" | "completed" | "stopped";
  assessments: { at: string; point: number; values: Assessment }[];
}
export interface Participant {
  id: string;
  consent: boolean;
  guardianConsent: boolean;
}
export interface Data {
  schemaVersion: 1;
  participant: Participant;
  participants: Participant[];
  results: Result[];
  experiments: Experiment[];
  sessions: ResearchSession[];
}
export interface Baseline {
  mean: number;
  accuracy: number;
  variability: number;
  count: number;
}
export interface PredictionResult {
  status: "insufficient";
  algorithmVersion: string;
}
export interface TestDefinition {
  kind: TestKind;
  trials: number;
  description: string;
}
export type TestAttempt = Attempt;
export type TestResult = Result;
export type SubjectiveAssessment = Assessment;
