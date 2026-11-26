import { OWNER_ACTOR, type TaskPatch } from '@todz/core';
import { FairUseLimit, TaskPlacement } from '@todz/types';
import { z } from 'zod';
import { fairUseLimitsOf } from './fair-use-limits';
import { HttpStatus } from './http-status';
import { AddArgumentsSchema, draftsOf } from './mcp-tool-arguments';
import { OwnerErrorCode, errorResponse, failureResponse } from './owner-errors';
import { historyEntryJson, taskJson } from './owner-json';
import { ownedProjectOf } from './owner-project';
import { type SessionContext, parsedBody, routeParam } from './owner-request';
import { RouteParam } from './owner-routes';
import { fieldPatchOf } from './task-field-patch';
import { NO_TEXT_BYTES, ONE_WRITE, refusalOf, textBytesOf } from './owner-write-quota';
import { batchFailureOf, completionFailureOf, draftsFailureOf, fieldsFailureOf } from './write-rules';

const TaskNumberSchema = z.number().int().positive();

const PlacementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum([TaskPlacement.First, TaskPlacement.Last]) }),
  z.object({ kind: z.enum([TaskPlacement.Before, TaskPlacement.After]), anchor: TaskNumberSchema }),
]);

const UpdateBodySchema = z.object({
  title: z.string().optional(),
  notes: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  placement: PlacementSchema.optional(),
});

const CompleteBodySchema = z.object({ numbers: z.array(TaskNumberSchema), note: z.string().nullable().default(null) });

const ReopenBodySchema = z.object({ numbers: z.array(TaskNumberSchema) });

function patchOf(body: z.output<typeof UpdateBodySchema>): TaskPatch {
  return { ...fieldPatchOf(body), ...('placement' in body && { placement: body.placement }) };
}

function taskNumberOf(context: SessionContext): number {
  return Number(routeParam({ context, name: RouteParam.Number }));
}

export async function addTasks(context: SessionContext): Promise<Response> {
  const body = await parsedBody({ request: context.request, schema: AddArgumentsSchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const project = await ownedProjectOf(context);
  if (project === null) return errorResponse(OwnerErrorCode.NotFound);
  const drafts = draftsOf(body);
  const draftsFailure = draftsFailureOf(drafts);
  if (draftsFailure !== null) return failureResponse(draftsFailure);
  const refusal = await refusalOf({
    context,
    writes: drafts.length,
    bytes: textBytesOf(drafts.flatMap((draft) => [draft.title, draft.notes])),
  });
  if (refusal !== null) return refusal;
  const limits = fairUseLimitsOf(context.env);
  const result = await project.addTasks({ actor: OWNER_ACTOR, drafts, openTasksMax: limits[FairUseLimit.OpenTasks] });
  if (!result.ok) return failureResponse(result.failure);
  const tasks = result.value.map(({ task, replayed }) => ({ task: taskJson(task), replayed }));
  return Response.json({ tasks }, { status: HttpStatus.Created });
}

export async function updateTask(context: SessionContext): Promise<Response> {
  const body = await parsedBody({ request: context.request, schema: UpdateBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const project = await ownedProjectOf(context);
  if (project === null) return errorResponse(OwnerErrorCode.NotFound);
  const fieldsFailure = fieldsFailureOf(body);
  if (fieldsFailure !== null) return failureResponse(fieldsFailure);
  const refusal = await refusalOf({ context, writes: ONE_WRITE, bytes: textBytesOf([body.title, body.notes]) });
  if (refusal !== null) return refusal;
  const result = await project.updateTask({ actor: OWNER_ACTOR, number: taskNumberOf(context), patch: patchOf(body) });
  if (!result.ok) return failureResponse(result.failure);
  return Response.json({ task: taskJson(result.value) });
}

export async function completeTasks(context: SessionContext): Promise<Response> {
  const body = await parsedBody({ request: context.request, schema: CompleteBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const project = await ownedProjectOf(context);
  if (project === null) return errorResponse(OwnerErrorCode.NotFound);
  const completionFailure = completionFailureOf({ size: body.numbers.length, note: body.note });
  if (completionFailure !== null) return failureResponse(completionFailure);
  const refusal = await refusalOf({ context, writes: body.numbers.length, bytes: textBytesOf([body.note]) });
  if (refusal !== null) return refusal;
  const result = await project.completeTasks({ actor: OWNER_ACTOR, numbers: body.numbers, note: body.note });
  if (!result.ok) return failureResponse(result.failure);
  const tasks = result.value.map(({ task, alreadyDone }) => ({ task: taskJson(task), already_done: alreadyDone }));
  return Response.json({ tasks });
}

export async function reopenTasks(context: SessionContext): Promise<Response> {
  const body = await parsedBody({ request: context.request, schema: ReopenBodySchema });
  if (body === null) return errorResponse(OwnerErrorCode.InvalidRequest);
  const project = await ownedProjectOf(context);
  if (project === null) return errorResponse(OwnerErrorCode.NotFound);
  const batchFailure = batchFailureOf(body.numbers.length);
  if (batchFailure !== null) return failureResponse(batchFailure);
  const refusal = await refusalOf({ context, writes: body.numbers.length, bytes: NO_TEXT_BYTES });
  if (refusal !== null) return refusal;
  const limits = fairUseLimitsOf(context.env);
  const result = await project.reopenTasks({ actor: OWNER_ACTOR, numbers: body.numbers, openTasksMax: limits[FairUseLimit.OpenTasks] });
  if (!result.ok) return failureResponse(result.failure);
  const tasks = result.value.map(({ task, alreadyOpen }) => ({ task: taskJson(task), already_open: alreadyOpen }));
  return Response.json({ tasks });
}

export async function readHistory(context: SessionContext): Promise<Response> {
  const project = await ownedProjectOf(context);
  if (project === null) return errorResponse(OwnerErrorCode.NotFound);
  const result = await project.readHistory({ number: taskNumberOf(context) });
  if (!result.ok) return failureResponse(result.failure);
  return Response.json({ history: result.value.map(historyEntryJson) });
}
