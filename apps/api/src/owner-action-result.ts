import type { ProjectFailure } from './project-result';

export enum ActionFailureKind {
  NotFound = 'not_found',
  LimitReached = 'limit_reached',
  InboxIsFixed = 'inbox_is_fixed',
  TimeZoneInvalid = 'time_zone_invalid',
  RuleViolated = 'rule_violated',
}

export type ActionFailure =
  { kind: Exclude<ActionFailureKind, ActionFailureKind.RuleViolated> } | { kind: ActionFailureKind.RuleViolated; failure: ProjectFailure };

export type ActionResult<Value> = { ok: true; value: Value } | { ok: false; failure: ActionFailure };

export function failed(kind: Exclude<ActionFailureKind, ActionFailureKind.RuleViolated>): ActionResult<never> {
  return { ok: false, failure: { kind } };
}
