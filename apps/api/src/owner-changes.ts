import { digestCredential } from './credential-digest';
import { HttpHeader } from './http-header';
import { OwnerErrorCode, errorResponse, failureResponse } from './owner-errors';
import { taskJson } from './owner-json';
import { ownedProjectOf } from './owner-project';
import type { SessionContext } from './owner-request';

const CURSOR_PARAMETER = 'cursor';
const CURSOR_PATTERN = /^(0|[1-9][0-9]*)$/;

function cursorOf(request: Request): number | null {
  const [text, ...rest] = new URL(request.url).searchParams.getAll(CURSOR_PARAMETER);
  const isMalformedCursor = text === undefined || rest.length > 0 || !CURSOR_PATTERN.test(text);
  if (isMalformedCursor) return null;
  const cursor = Number(text);
  if (!Number.isSafeInteger(cursor)) return null;
  return cursor;
}

export async function readChanges(context: SessionContext): Promise<Response> {
  const cursor = cursorOf(context.request);
  if (cursor === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const project = await ownedProjectOf(context);
  if (project === null) return errorResponse(OwnerErrorCode.NotFound);
  const result = await project.readChanges({ cursor });
  if (!result.ok) return failureResponse(result.failure);
  const { tasks, deletedNumbers, cursor: nextCursor, hasMore } = result.value;
  return Response.json({ tasks: tasks.map(taskJson), deleted_numbers: deletedNumbers, cursor: nextCursor, has_more: hasMore });
}

export async function watchChanges(context: SessionContext): Promise<Response> {
  const project = await ownedProjectOf(context);
  if (project === null) return errorResponse(OwnerErrorCode.NotFound);
  const sessionRequest = new Request(context.request);
  sessionRequest.headers.set(HttpHeader.SessionDigest, await digestCredential(context.secret));
  return project.fetch(sessionRequest);
}
