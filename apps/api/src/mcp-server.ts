import { CLIENT_INFO_META_KEY, type CallToolResult, McpServer, type ServerContext } from '@modelcontextprotocol/server';
import { type Actor, type DueNow, type Task, parseShortId } from '@todz/core';
import { ActorKind, FairUseLimit } from '@todz/types';
import type { FairUseLimits } from './fair-use-limits';
import { textBytesOf } from './owner-write-quota';
import { z } from 'zod';
import { MCP_COPY, McpPromptName, McpToolName } from './mcp-copy';
import {
  addedAnswer,
  completedAnswer,
  failureText,
  listAnswer,
  nextAnswer,
  nextPromptText,
  nudgeLine,
  nudgedText,
  updatedAnswer,
} from './mcp-format';
import {
  AddArgumentsSchema,
  DoneArgumentsSchema,
  ListArgumentsSchema,
  UpdateArgumentsSchema,
  draftsOf,
  patchOf,
  taskNumbers,
} from './mcp-tool-arguments';
import type { ProjectResult } from './project-result';
import type { ProjectStore } from './project-store';

const MCP_SERVER_NAME = 'todz';
export const MCP_SERVER_VERSION = '0.1.0';
const TEXT_CONTENT = 'text';
const USER_ROLE = 'user';
const READ_ONLY_ANNOTATIONS = { readOnlyHint: true };
const WRITE_ANNOTATIONS = { destructiveHint: false };
const NOTHING_DUE = 0;

const EnvelopeClientSchema = z.object({ [CLIENT_INFO_META_KEY]: z.object({ name: z.string() }) });

export type ClientNameOf = (ctx: ServerContext) => string | null;

export type WriteRefusalTextOf = (args: { writes: number; bytes: number }) => Promise<string | null>;

export type McpServerScope = {
  project: DurableObjectStub<ProjectStore>;
  today: string;
  agentNudge: boolean;
  clientNameOf: ClientNameOf;
  limits: FairUseLimits;
  refusalTextOf: WriteRefusalTextOf;
};

export function envelopeClientName(ctx: ServerContext): string | null {
  const envelope = EnvelopeClientSchema.safeParse(ctx.mcpReq.envelope);
  if (!envelope.success) return null;
  return envelope.data[CLIENT_INFO_META_KEY].name;
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

function registerReadTools({ server, scope }: { server: McpServer; scope: McpServerScope }): void {
  const { project, today } = scope;
  server.registerTool(McpToolName.Next, { description: MCP_COPY.tools[McpToolName.Next], annotations: READ_ONLY_ANNOTATIONS }, async () => {
    const result = await project.nextTask({ today });
    if (!result.ok) return errorAnswer(failureText(result.failure));
    const nudge = await nudgeOf({ scope, task: result.value });
    return textAnswer(nudgedText({ nudge, text: nextAnswer(result.value) }));
  });
  server.registerTool(
    McpToolName.List,
    { description: MCP_COPY.tools[McpToolName.List], inputSchema: ListArgumentsSchema, annotations: READ_ONLY_ANNOTATIONS },
    async ({ state, due, text, limit }) => {
      const result = await project.listTasks({ today, filter: { state, dueWindows: due, text, limit } });
      return resultAnswer({ result, answer: (list) => listAnswer({ state, list }) });
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

function registerWriteTools({ server, scope }: { server: McpServer; scope: McpServerScope }): void {
  const { project, clientNameOf, limits, refusalTextOf } = scope;
  server.registerTool(
    McpToolName.Add,
    { description: MCP_COPY.tools[McpToolName.Add], inputSchema: AddArgumentsSchema, annotations: WRITE_ANNOTATIONS },
    async (args, ctx) =>
      asAgent({
        clientNameOf,
        ctx,
        write: async (actor) => {
          const drafts = draftsOf(args);
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
  );
  server.registerTool(
    McpToolName.Update,
    { description: MCP_COPY.tools[McpToolName.Update], inputSchema: UpdateArgumentsSchema, annotations: WRITE_ANNOTATIONS },
    async (args, ctx) => {
      const number = parseShortId(args.id);
      const patch = patchOf(args);
      const hasInvalidId = number === null || patch === null;
      if (hasInvalidId) return errorAnswer(MCP_COPY.taskIdInvalid);
      return asAgent({
        clientNameOf,
        ctx,
        write: async (actor) => {
          const refusal = await refusedAnswer({ refusalTextOf, writes: 1, bytes: textBytesOf([args.title, args.notes]) });
          if (refusal !== null) return refusal;
          return resultAnswer({ result: await project.updateTask({ actor, number, patch }), answer: updatedAnswer });
        },
      });
    },
  );
  server.registerTool(
    McpToolName.Done,
    { description: MCP_COPY.tools[McpToolName.Done], inputSchema: DoneArgumentsSchema, annotations: WRITE_ANNOTATIONS },
    async ({ ids, note }, ctx) => {
      const numbers = taskNumbers(ids);
      if (numbers === null) return errorAnswer(MCP_COPY.taskIdInvalid);
      return asAgent({
        clientNameOf,
        ctx,
        write: async (actor) => {
          const refusal = await refusedAnswer({ refusalTextOf, writes: numbers.length, bytes: textBytesOf([note]) });
          if (refusal !== null) return refusal;
          return resultAnswer({ result: await project.completeTasks({ actor, numbers, note }), answer: completedAnswer });
        },
      });
    },
  );
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

export function buildMcpServer(scope: McpServerScope): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION }, { instructions: MCP_COPY.instructions });
  registerReadTools({ server, scope });
  registerWriteTools({ server, scope });
  registerNextPrompt({ server, scope });
  return server;
}
