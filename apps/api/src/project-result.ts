import type { RuleIssue } from '@todz/types';

export enum ProjectFailureKind {
  TaskNotFound = 'task_not_found',
  RuleViolated = 'rule_violated',
}

export type ProjectFailure =
  | { kind: ProjectFailureKind.TaskNotFound; number: number }
  | { kind: ProjectFailureKind.RuleViolated; issue: RuleIssue; index: number | null };

export type ProjectResult<Value> = { ok: true; value: Value } | { ok: false; failure: ProjectFailure };
