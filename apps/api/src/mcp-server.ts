import { type CallToolResult, McpServer, type ServerContext } from '@modelcontextprotocol/server';
import { type Actor, type DueNow, type Task, parseShortId } from '@todz/core';
import { ActorKind, FairUseLimit, HistoryAction, RuleIssue } from '@todz/types';
import { z } from 'zod';
import type { FairUseLimits } from './fair-use-limits';
import { annotationsOf } from './mcp-annotations';
import { NO_TEXT_BYTES, ONE_WRITE, textBytesOf } from './owner-write-quota';
import { MCP_COPY, McpPromptName, McpToolName } from './mcp-copy';
import {
  addedAnswer,
  completedAnswer,
  deletedAnswer,
  failureText,
  historyAnswer,
  listAnswer,
  movedAnswer,
  nextAnswer,
  nextPromptText,
  nudgeLine,
  nudgedText,
  projectsAnswer,
  reopenedAnswer,
  showAnswer,
  updatedAnswer,
} from './mcp-format';
import { OwnerMoveArgumentsSchema, TaskProjectShape } from './mcp-owner-arguments';
import {
  AddArgumentsSchema,
  DeleteArgumentsSchema,
  DoneArgumentsSchema,
  HistoryArgumentsSchema,
  ListArgumentsSchema,
  MoveArgumentsSchema,
  NoArgumentsSchema,
  ReopenArgumentsSchema,
  ShowArgumentsSchema,
  UpdateArgumentsSchema,
  draftsOf,
  patchOf,
  taskNumbers,
} from './mcp-tool-arguments';
import { calendarDateInTimeZone } from './owner-today';
import { moveTask } from './move-task';
import type { ProjectResult } from './project-result';
import type { GrantProject, GrantWorkspace } from './project-routing';
import type { ProjectStore } from './project-store';
import { batchFailureOf, completionFailureOf, draftsFailureOf, fieldsFailureOf } from './write-rules';

const MCP_SERVER_NAME = 'todz';
export const MCP_SERVER_VERSION = '0.1.0';
const TEXT_CONTENT = 'text';
const USER_ROLE = 'user';
const NOTHING_DUE = 0;

export type ClientNameOf = (ctx: ServerContext) => string | null;

export type WriteRefusalTextOf = (args: { writes: number; bytes: number }) => Promise<string | null>;

export type McpServerScope = {
  project: DurableObjectStub<ProjectStore>;
  workspace: GrantWorkspace;
  today: string;
  agentNudge: boolean;
  clientNameOf: ClientNameOf;
  limits: FairUseLimits;
  refusalTextOf: WriteRefusalTextOf;
};

export enum TaskAccessKind {
  Project = 'project',
  Owner = 'owner',
}

export type TaskAccess =
  | { kind: TaskAccessKind.Project; scope: McpServerScope }
  | { kind: TaskAccessKind.Owner; scopeOf: (projectId: string) => Promise<McpServerScope | null> };

type OwnerTaskAccess = Extract<TaskAccess, { kind: TaskAccessKind.Owner }>;

type TaskRun<Args> = (input: { scope: McpServerScope; args: Args; ctx: ServerContext }) => Promise<CallToolResult>;

export function mcpScopeOf({
  grantProject,
  now,
  clientNameOf,
  limits,
  refusalTextOf,
}: { grantProject: GrantProject; now: number } & Pick<McpServerScope, 'clientNameOf' | 'limits' | 'refusalTextOf'>): McpServerScope {
  return {
    project: grantProject.project,
    workspace: grantProject.workspace,
    today: calendarDateInTimeZone({ timeZone: grantProject.timeZone, now }),
    agentNudge: grantProject.agentNudge,
    clientNameOf,
    limits,
    refusalTextOf,
  };
}

function textAnswer(text: string): CallToolResult {
  return { content: [{ type: TEXT_CONTENT, text }] };
}

function errorAnswer(text: string): CallToolResult {
  return { content: [{ type: TEXT_CONTENT, text }], isError: true };
}

function resultAnswer<Value>({ result, answer }: { result: ProjectResult<Value>; answer: (value: Value) => string }): CallToolResult {
  if (!result.ok) return errorAnswer(failureText(result.failure));
  return textAnswer(answer(result.value));
}

async function dueNowOf({ project, today }: Pick<McpServerScope, 'project' | 'today'>): Promise<DueNow | null> {
  try {
    const result = await project.dueNow({ today });
    if (!result.ok) return null;
    return result.value;
  } catch {
    return null;
  }
}

async function nudgeOf({ scope, task }: { scope: McpServerScope; task: Task | null }): Promise<string | null> {
  const isSilent = !scope.agentNudge || task === null;
  if (isSilent) return null;
  const dueNow = await dueNowOf(scope);
  const isNothingToSay = dueNow === null || dueNow.count === NOTHING_DUE;
  if (isNothingToSay) return null;
  return nudgeLine({ ...dueNow, taskNumber: task.number });
}

async function asAgent({
  clientNameOf,
  ctx,
  write,
}: {
  clientNameOf: ClientNameOf;
  ctx: ServerContext;
  write: (actor: Actor) => Promise<CallToolResult>;
}): Promise<CallToolResult> {
  const clientName = clientNameOf(ctx);
  if (clientName === null) return errorAnswer(MCP_COPY.clientUnnamed);
  return write({ kind: ActorKind.Agent, clientName });
}

async function inOwnedProject({
  access,
  projectId,
  run,
}: {
  access: OwnerTaskAccess;
  projectId: string;
  run: (scope: McpServerScope) => Promise<CallToolResult>;
}): Promise<CallToolResult> {
  const scope = await access.scopeOf(projectId);
  if (scope === null) return errorAnswer(MCP_COPY.accountNotFound);
  return run(scope);
}

function registerTaskTool<Schema extends z.ZodObject>({
  server,
  access,
  name,
  schema,
  run,
}: {
  server: McpServer;
  access: TaskAccess;
  name: McpToolName;
  schema: Schema;
  run: TaskRun<z.infer<Schema>>;
}): void {
  const definition = { description: MCP_COPY.tools[name], annotations: annotationsOf(name) };
  if (access.kind === TaskAccessKind.Project) {
    server.registerTool(name, { ...definition, inputSchema: schema as z.ZodObject }, (args, ctx) =>
      run({ scope: access.scope, args: args as z.infer<Schema>, ctx }),
    );
    return;
  }
  server.registerTool(name, { ...definition, inputSchema: schema.extend(TaskProjectShape) as z.ZodObject }, (args, ctx) =>
    inOwnedProject({ access, projectId: String(args.project), run: (scope) => run({ scope, args: args as z.infer<Schema>, ctx }) }),
  );
}

function registerReadTools({ server, access }: { server: McpServer; access: TaskAccess }): void {
  registerTaskTool({
    server,
    access,
    name: McpToolName.Next,
    schema: NoArgumentsSchema,
    run: async ({ scope }) => {
      const result = await scope.project.nextTask({ today: scope.today });
      if (!result.ok) return errorAnswer(failureText(result.failure));
      const nudge = await nudgeOf({ scope, task: result.value });
      return textAnswer(nudgedText({ nudge, text: nextAnswer(result.value) }));
    },
  });
  registerTaskTool({
    server,
    access,
    name: McpToolName.List,
    schema: ListArgumentsSchema,
    run: async ({ scope, args: { state, due, text, limit } }) => {
      const result = await scope.project.listTasks({ today: scope.today, filter: { state, dueWindows: due, text, limit } });
      return resultAnswer({ result, answer: (list) => listAnswer({ state, list }) });
    },
  });
  registerTaskTool({
    server,
    access,
    name: McpToolName.Show,
    schema: ShowArgumentsSchema,
    run: async ({ scope, args: { id } }) => {
      const number = parseShortId(id);
      if (number === null) return errorAnswer(MCP_COPY.taskIdInvalid);
      const result = await scope.project.readTask({ number });
      if (!result.ok) return errorAnswer(failureText(result.failure));
      const history = await scope.project.readHistory({ number });
      const arrivalNote = history.ok ? history.value.find((entry) => entry.action === HistoryAction.Created)?.note : undefined;
      return textAnswer(showAnswer({ task: result.value, arrivalNote }));
    },
  });
  registerTaskTool({
    server,
    access,
    name: McpToolName.History,
    schema: HistoryArgumentsSchema,
    run: async ({ scope, args: { id } }) => {
      const number = parseShortId(id);
      if (number === null) return errorAnswer(MCP_COPY.taskIdInvalid);
      return resultAnswer({ result: await scope.project.readHistory({ number }), answer: historyAnswer });
    },
  });
}

function registerProjectsTool({ server, scope }: { server: McpServer; scope: McpServerScope }): void {
  server.registerTool(
    McpToolName.Projects,
    { description: MCP_COPY.tools[McpToolName.Projects], annotations: annotationsOf(McpToolName.Projects) },
    async () => {
      const projects = await scope.workspace.listProjects();
      return textAnswer(projectsAnswer({ projects, currentProjectId: scope.workspace.projectId }));
    },
  );
}

async function refusedAnswer({
  refusalTextOf,
  writes,
  bytes,
}: {
  refusalTextOf: WriteRefusalTextOf;
  writes: number;
  bytes: number;
}): Promise<CallToolResult | null> {
  const refusal = await refusalTextOf({ writes, bytes });
  if (refusal === null) return null;
  return errorAnswer(refusal);
}

async function moveRun({
  scope,
  id,
  destinationId,
  ctx,
}: {
  scope: McpServerScope;
  id: string;
  destinationId: string;
  ctx: ServerContext;
}): Promise<CallToolResult> {
  const { project, clientNameOf, limits, refusalTextOf } = scope;
  const number = parseShortId(id);
  if (number === null) return errorAnswer(MCP_COPY.taskIdInvalid);
  const sibling = await scope.workspace.openSibling(destinationId);
  if (sibling === null) return errorAnswer(MCP_COPY.projectNotInWorkspace);
  return asAgent({
    clientNameOf,
    ctx,
    write: async (actor) => {
      const sourceProject = (await scope.workspace.listProjects()).find((record) => record.id === scope.workspace.projectId);
      if (sourceProject === undefined) throw new Error('a project grant is in its own workspace');
      const read = await project.readTask({ number });
      if (!read.ok) return errorAnswer(failureText(read.failure));
      const bytes = textBytesOf([read.value.title, read.value.notes]);
      const refusal = await refusedAnswer({ refusalTextOf, writes: ONE_WRITE, bytes });
      if (refusal !== null) return refusal;
      const result = await moveTask({
        openTasksMax: limits[FairUseLimit.OpenTasks],
        source: project,
        sourceProjectId: scope.workspace.projectId,
        sourceProjectName: sourceProject.name,
        destination: sibling.project,
        isDestinationListed: async () => (await scope.workspace.openSibling(destinationId)) !== null,
        actor,
        number,
      });
      return resultAnswer({ result, answer: (moved) => movedAnswer({ moved, projectName: sibling.record.name }) });
    },
  });
}

function registerMoveTool({ server, access }: { server: McpServer; access: TaskAccess }): void {
  const definition = { description: MCP_COPY.tools[McpToolName.Move], annotations: annotationsOf(McpToolName.Move) };
  if (access.kind === TaskAccessKind.Project) {
    server.registerTool(McpToolName.Move, { ...definition, inputSchema: MoveArgumentsSchema }, ({ id, project }, ctx) =>
      moveRun({ scope: access.scope, id, destinationId: project, ctx }),
    );
    return;
  }
  server.registerTool(McpToolName.Move, { ...definition, inputSchema: OwnerMoveArgumentsSchema }, ({ id, project, destination }, ctx) =>
    inOwnedProject({ access, projectId: project, run: (scope) => moveRun({ scope, id, destinationId: destination, ctx }) }),
  );
}

function registerWriteTools({ server, access }: { server: McpServer; access: TaskAccess }): void {
  registerTaskTool({
    server,
    access,
    name: McpToolName.Add,
    schema: AddArgumentsSchema,
    run: ({ scope: { project, clientNameOf, limits, refusalTextOf }, args, ctx }) =>
      asAgent({
        clientNameOf,
        ctx,
        write: async (actor) => {
          const drafts = draftsOf(args);
          const draftsFailure = draftsFailureOf(drafts);
          if (draftsFailure !== null) return errorAnswer(failureText(draftsFailure));
          const refusal = await refusedAnswer({
            refusalTextOf,
            writes: drafts.length,
            bytes: textBytesOf(drafts.flatMap((draft) => [draft.title, draft.notes])),
          });
          if (refusal !== null) return refusal;
          return resultAnswer({
            result: await project.addTasks({ actor, drafts, openTasksMax: limits[FairUseLimit.OpenTasks] }),
            answer: addedAnswer,
          });
        },
      }),
  });
  registerTaskTool({
    server,
    access,
    name: McpToolName.Update,
    schema: UpdateArgumentsSchema,
    run: async ({ scope: { project, clientNameOf, refusalTextOf }, args, ctx }) => {
      const number = parseShortId(args.id);
      const patch = patchOf(args);
      const hasInvalidId = number === null || patch === null;
      if (hasInvalidId) return errorAnswer(MCP_COPY.taskIdInvalid);
      return asAgent({
        clientNameOf,
        ctx,
        write: async (actor) => {
          const fieldsFailure = fieldsFailureOf(args);
          if (fieldsFailure !== null) return errorAnswer(failureText(fieldsFailure));
          const refusal = await refusedAnswer({ refusalTextOf, writes: ONE_WRITE, bytes: textBytesOf([args.title, args.notes]) });
          if (refusal !== null) return refusal;
          return resultAnswer({ result: await project.updateTask({ actor, number, patch }), answer: updatedAnswer });
        },
      });
    },
  });
  registerTaskTool({
    server,
    access,
    name: McpToolName.Done,
    schema: DoneArgumentsSchema,
    run: async ({ scope: { project, clientNameOf, refusalTextOf }, args: { ids, note }, ctx }) => {
      const numbers = taskNumbers(ids);
      if (numbers === null) return errorAnswer(MCP_COPY.taskIdInvalid);
      return asAgent({
        clientNameOf,
        ctx,
        write: async (actor) => {
          const completionFailure = completionFailureOf({ size: numbers.length, note });
          if (completionFailure !== null) return errorAnswer(failureText(completionFailure));
          const refusal = await refusedAnswer({ refusalTextOf, writes: numbers.length, bytes: textBytesOf([note]) });
          if (refusal !== null) return refusal;
          return resultAnswer({ result: await project.completeTasks({ actor, numbers, note }), answer: completedAnswer });
        },
      });
    },
  });
  registerTaskTool({
    server,
    access,
    name: McpToolName.Reopen,
    schema: ReopenArgumentsSchema,
    run: async ({ scope: { project, clientNameOf, limits, refusalTextOf }, args: { ids }, ctx }) => {
      const numbers = taskNumbers(ids);
      if (numbers === null) return errorAnswer(MCP_COPY.taskIdInvalid);
      return asAgent({
        clientNameOf,
        ctx,
        write: async (actor) => {
          const batchFailure = batchFailureOf(numbers.length);
          if (batchFailure !== null) return errorAnswer(failureText(batchFailure));
          const refusal = await refusedAnswer({ refusalTextOf, writes: numbers.length, bytes: NO_TEXT_BYTES });
          if (refusal !== null) return refusal;
          const result = await project.reopenTasks({ actor, numbers, openTasksMax: limits[FairUseLimit.OpenTasks] });
          return resultAnswer({ result, answer: reopenedAnswer });
        },
      });
    },
  });
  registerTaskTool({
    server,
    access,
    name: McpToolName.Delete,
    schema: DeleteArgumentsSchema,
    run: async ({ scope: { project, clientNameOf, refusalTextOf }, args: { id, confirm }, ctx }) => {
      const number = parseShortId(id);
      if (number === null) return errorAnswer(MCP_COPY.taskIdInvalid);
      return asAgent({
        clientNameOf,
        ctx,
        write: async () => {
          const read = await project.readTask({ number });
          if (!read.ok) return errorAnswer(failureText(read.failure));
          if (confirm.trim() !== read.value.title) return errorAnswer(MCP_COPY.ruleIssue[RuleIssue.ConfirmationMismatch]);
          const refusal = await refusedAnswer({ refusalTextOf, writes: ONE_WRITE, bytes: NO_TEXT_BYTES });
          if (refusal !== null) return refusal;
          return resultAnswer({ result: await project.deleteTask({ number, confirmation: confirm }), answer: deletedAnswer });
        },
      });
    },
  });
  registerMoveTool({ server, access });
}

function registerNextPrompt({ server, scope }: { server: McpServer; scope: McpServerScope }): void {
  const { project, today } = scope;
  server.registerPrompt(McpPromptName.Next, { description: MCP_COPY.prompts[McpPromptName.Next] }, async () => {
    const result = await project.nextTask({ today });
    if (!result.ok) throw new Error(failureText(result.failure));
    const nudge = await nudgeOf({ scope, task: result.value });
    const text = nudgedText({ nudge, text: nextPromptText(result.value) });
    return { messages: [{ role: USER_ROLE, content: { type: TEXT_CONTENT, text } }] };
  });
}

export function registerTaskTools({ server, access }: { server: McpServer; access: TaskAccess }): void {
  registerReadTools({ server, access });
  registerWriteTools({ server, access });
}

export function buildMcpServer(scope: McpServerScope): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION }, { instructions: MCP_COPY.instructions });
  registerTaskTools({ server, access: { kind: TaskAccessKind.Project, scope } });
  registerProjectsTool({ server, scope });
  registerNextPrompt({ server, scope });
  return server;
}
