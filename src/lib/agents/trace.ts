/** One step in the "Under the hood" agent trace panel. Safe to import on the client. */
export type AgentName =
  | "diagnostician"
  | "detective"
  | "planner"
  | "generator"
  | "verifier"
  | "coach"
  | "teacher_analyst"
  | "learner_model";

export type TraceStatus = "ok" | "fallback" | "rejected" | "error";

export interface TraceStep {
  agent: AgentName;
  /** One human-readable line, e.g. "Verifier rejected 1 draft: answer mismatch" */
  summary: string;
  ms: number;
  status: TraceStatus;
}
