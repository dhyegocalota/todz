import { RuleViolation, TaskNotFoundError } from '@todz/core';
import type { RuleIssue } from '@todz/types';

export enum ProjectFailureKind {
  TaskNotFound = 'task_not_found',
  RuleViolated = 'rule_violated',
}

export type ProjectFailure =
  | { kind: ProjectFailureKind.TaskNotFound; number: number }
  | { kind: ProjectFailureKind.RuleViolated; issue: RuleIssue; index: number | null };

export type ProjectResult<Value> = { ok: true; value: Value } | { ok: false; failure: ProjectFailure };

export function resultOf<Value>(run: () => Value): ProjectResult<Value> {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    if (error instanceof TaskNotFoundError) return { ok: false, failure: { kind: ProjectFailureKind.TaskNotFound, number: error.number } };
    if (error instanceof RuleViolation) {
      return { ok: false, failure: { kind: ProjectFailureKind.RuleViolated, issue: error.issue, index: error.index } };
    }
    throw error;
  }
}
