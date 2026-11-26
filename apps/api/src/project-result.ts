import { LimitViolation, RuleViolation, TaskNotFoundError } from '@todz/core';
import type { FairUseLimit, RuleIssue } from '@todz/types';

export enum ProjectFailureKind {
  TaskNotFound = 'task_not_found',
  RuleViolated = 'rule_violated',
  CursorAhead = 'cursor_ahead',
  LimitReached = 'limit_reached',
}

export type ProjectFailure =
  | { kind: ProjectFailureKind.TaskNotFound; number: number }
  | { kind: ProjectFailureKind.CursorAhead }
  | { kind: ProjectFailureKind.RuleViolated; issue: RuleIssue; index: number | null }
  | { kind: ProjectFailureKind.LimitReached; limit: FairUseLimit; max: number };

export type ProjectResult<Value> = { ok: true; value: Value } | { ok: false; failure: ProjectFailure };

export function resultOf<Value>(run: () => Value): ProjectResult<Value> {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    if (error instanceof TaskNotFoundError) return { ok: false, failure: { kind: ProjectFailureKind.TaskNotFound, number: error.number } };
    if (error instanceof LimitViolation) {
      return { ok: false, failure: { kind: ProjectFailureKind.LimitReached, limit: error.limit, max: error.max } };
    }
    if (error instanceof RuleViolation) {
      return { ok: false, failure: { kind: ProjectFailureKind.RuleViolated, issue: error.issue, index: error.index } };
    }
    throw error;
  }
}
