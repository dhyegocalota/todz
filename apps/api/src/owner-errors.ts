import { HttpStatus } from './http-status';
import { type ProjectFailure, ProjectFailureKind } from './project-result';

export enum OwnerErrorCode {
  InvalidRequest = 'invalid_request',
  IdentityRejected = 'identity_rejected',
  NotFound = 'not_found',
  TaskNotFound = 'task_not_found',
  InboxIsFixed = 'inbox_is_fixed',
  CursorAhead = 'cursor_ahead',
  RuleViolated = 'rule_violated',
  TimeZoneInvalid = 'time_zone_invalid',
  SignInUnavailable = 'sign_in_unavailable',
}

const STATUS_OF_CODE: Record<OwnerErrorCode, HttpStatus> = {
  [OwnerErrorCode.InvalidRequest]: HttpStatus.BadRequest,
  [OwnerErrorCode.IdentityRejected]: HttpStatus.Unauthorized,
  [OwnerErrorCode.NotFound]: HttpStatus.NotFound,
  [OwnerErrorCode.TaskNotFound]: HttpStatus.NotFound,
  [OwnerErrorCode.InboxIsFixed]: HttpStatus.Conflict,
  [OwnerErrorCode.CursorAhead]: HttpStatus.Conflict,
  [OwnerErrorCode.RuleViolated]: HttpStatus.Unprocessable,
  [OwnerErrorCode.TimeZoneInvalid]: HttpStatus.Unprocessable,
  [OwnerErrorCode.SignInUnavailable]: HttpStatus.Unavailable,
};

export function errorResponse(code: OwnerErrorCode): Response {
  return Response.json({ error: code }, { status: STATUS_OF_CODE[code] });
}

export function noRouteResponse(): Response {
  return new Response(null, { status: HttpStatus.NotFound });
}

export function failureResponse(failure: ProjectFailure): Response {
  if (failure.kind === ProjectFailureKind.CursorAhead) return errorResponse(OwnerErrorCode.CursorAhead);
  if (failure.kind === ProjectFailureKind.TaskNotFound) {
    return Response.json(
      { error: OwnerErrorCode.TaskNotFound, number: failure.number },
      { status: STATUS_OF_CODE[OwnerErrorCode.TaskNotFound] },
    );
  }
  return Response.json(
    { error: OwnerErrorCode.RuleViolated, issue: failure.issue, index: failure.index },
    { status: STATUS_OF_CODE[OwnerErrorCode.RuleViolated] },
  );
}
