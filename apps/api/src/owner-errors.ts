import { CloudLimit, FairUseLimit, MILLISECONDS_PER_DAY, MILLISECONDS_PER_SECOND, MINIMUM_APP_VERSION } from '@todz/types';
import { CLOUD_COPY } from './cloud-copy';
import { secondsUntilNextMonth } from './cloud-month';
import { FAIR_USE_COPY } from './fair-use-copy';
import type { FairUseLimits } from './fair-use-limits';
import { HttpHeader, NO_STORE } from './http-header';
import { HttpStatus } from './http-status';
import { type ProjectFailure, ProjectFailureKind } from './project-result';
import { utcDayStartOf } from './telemetry/telemetry-day';

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
  SignInRefused = 'sign_in_refused',
  AppTooOld = 'app_too_old',
  LimitReached = 'limit_reached',
  RateLimited = 'rate_limited',
  AccountSuspended = 'account_suspended',
  SignUpRefused = 'sign_up_refused',
  CloudFull = 'cloud_full',
  CodeLocked = 'code_locked',
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
  [OwnerErrorCode.SignInRefused]: HttpStatus.TooManyRequests,
  [OwnerErrorCode.AppTooOld]: HttpStatus.UpgradeRequired,
  [OwnerErrorCode.LimitReached]: HttpStatus.Conflict,
  [OwnerErrorCode.RateLimited]: HttpStatus.TooManyRequests,
  [OwnerErrorCode.AccountSuspended]: HttpStatus.Forbidden,
  [OwnerErrorCode.SignUpRefused]: HttpStatus.Forbidden,
  [OwnerErrorCode.CloudFull]: HttpStatus.Forbidden,
  [OwnerErrorCode.CodeLocked]: HttpStatus.TooManyRequests,
};

const STATUS_OF_LIMIT: Record<FairUseLimit, HttpStatus> = {
  [FairUseLimit.Workspaces]: HttpStatus.Conflict,
  [FairUseLimit.Projects]: HttpStatus.Conflict,
  [FairUseLimit.OpenTasks]: HttpStatus.Conflict,
  [FairUseLimit.DailyWrites]: HttpStatus.TooManyRequests,
  [FairUseLimit.StoredBytes]: HttpStatus.Conflict,
  [FairUseLimit.DailySignUps]: HttpStatus.TooManyRequests,
};

const DAILY_LIMITS: FairUseLimit[] = [FairUseLimit.DailyWrites, FairUseLimit.DailySignUps];

export function errorResponse(code: OwnerErrorCode): Response {
  return Response.json({ error: code }, { status: STATUS_OF_CODE[code] });
}

export function messageErrorResponse({ code, message }: { code: OwnerErrorCode; message: string }): Response {
  return Response.json({ error: code, message }, { status: STATUS_OF_CODE[code] });
}

export function suspendedResponse(): Response {
  return messageErrorResponse({ code: OwnerErrorCode.AccountSuspended, message: FAIR_USE_COPY.suspended });
}

export function signUpRefusedResponse(): Response {
  return messageErrorResponse({ code: OwnerErrorCode.SignUpRefused, message: FAIR_USE_COPY.signUpRefused });
}

export function cloudFullResponse(): Response {
  return messageErrorResponse({ code: OwnerErrorCode.CloudFull, message: CLOUD_COPY.full });
}

// NB ADR 0099: the 95% refusal is a 429 limit_reached with a message, the one body every installed app already reads as a fair-use pause that keeps its queue.
export function cloudAtCapacityResponse(now: number): Response {
  const body = { error: OwnerErrorCode.LimitReached, limit: CloudLimit.Capacity, message: CLOUD_COPY.atCapacity };
  const response = Response.json(body, { status: HttpStatus.TooManyRequests });
  response.headers.set(HttpHeader.RetryAfter, String(secondsUntilNextMonth(now)));
  return response;
}

export function secondsUntilNextUtcDay(now: number): number {
  return Math.ceil((utcDayStartOf(now) + MILLISECONDS_PER_DAY - now) / MILLISECONDS_PER_SECOND);
}

export function limitResponse({ limit, limits, now }: { limit: FairUseLimit; limits: FairUseLimits; now: number }): Response {
  const body = {
    error: OwnerErrorCode.LimitReached,
    limit,
    message: FAIR_USE_COPY.limitMessageOf({ limit, max: limits[limit] }),
  };
  const response = Response.json(body, { status: STATUS_OF_LIMIT[limit] });
  if (DAILY_LIMITS.includes(limit)) response.headers.set(HttpHeader.RetryAfter, String(secondsUntilNextUtcDay(now)));
  return response;
}

export function appTooOldResponse(): Response {
  return Response.json(
    { error: OwnerErrorCode.AppTooOld, minimum_app_version: MINIMUM_APP_VERSION },
    { status: STATUS_OF_CODE[OwnerErrorCode.AppTooOld], headers: { [HttpHeader.CacheControl]: NO_STORE } },
  );
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
  if (failure.kind === ProjectFailureKind.LimitReached) {
    return Response.json(
      {
        error: OwnerErrorCode.LimitReached,
        limit: failure.limit,
        message: FAIR_USE_COPY.limitMessageOf({ limit: failure.limit, max: failure.max }),
      },
      { status: STATUS_OF_CODE[OwnerErrorCode.LimitReached] },
    );
  }
  return Response.json(
    { error: OwnerErrorCode.RuleViolated, issue: failure.issue, index: failure.index },
    { status: STATUS_OF_CODE[OwnerErrorCode.RuleViolated] },
  );
}
