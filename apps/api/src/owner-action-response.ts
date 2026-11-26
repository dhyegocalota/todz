import { OwnerErrorCode, errorResponse, failureResponse } from './owner-errors';
import { type ActionFailure, ActionFailureKind } from './owner-action-result';

const ERROR_CODE_OF_FAILURE: Record<Exclude<ActionFailureKind, ActionFailureKind.RuleViolated>, OwnerErrorCode> = {
  [ActionFailureKind.NotFound]: OwnerErrorCode.NotFound,
  [ActionFailureKind.LimitReached]: OwnerErrorCode.LimitReached,
  [ActionFailureKind.InboxIsFixed]: OwnerErrorCode.InboxIsFixed,
  [ActionFailureKind.TimeZoneInvalid]: OwnerErrorCode.TimeZoneInvalid,
};

export function failedResponse(failure: ActionFailure): Response {
  if (failure.kind === ActionFailureKind.RuleViolated) return failureResponse(failure.failure);
  return errorResponse(ERROR_CODE_OF_FAILURE[failure.kind]);
}
