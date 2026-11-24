import { OwnerErrorCode, errorResponse, failureResponse } from './owner-errors';
import { taskJson } from './owner-json';
import { ownedProjectOf } from './owner-project';
import type { SessionContext } from './owner-request';

const CURSOR_PARAMETER = 'cursor';
const CURSOR_PATTERN = /^(0|[1-9][0-9]*)$/;

function cursorOf(request: Request): number | null {
  const text = new URL(request.url).searchParams.get(CURSOR_PARAMETER);
  if (text === null || !CURSOR_PATTERN.test(text)) return null;
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
  const { tasks, cursor: nextCursor, hasMore } = result.value;
  return Response.json({ tasks: tasks.map(taskJson), cursor: nextCursor, has_more: hasMore });
}

export async function watchChanges(context: SessionContext): Promise<Response> {
  const project = await ownedProjectOf(context);
  if (project === null) return errorResponse(OwnerErrorCode.NotFound);
  return project.fetch(context.request);
}
