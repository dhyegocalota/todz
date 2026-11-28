import { type CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { FairUseLimit, MINUTES_PER_HOUR } from '@todz/types';
import { type WorkspaceListing, listOwnerWorkspaces } from './directory-workspaces';
import type { Env } from './env';
import type { FairUseLimits } from './fair-use-limits';
import { MCP_COPY, McpOwnerToolName } from './mcp-copy';
import { annotationsOf } from './mcp-annotations';
import {
  type ClientNameOf,
  type McpServerScope,
  TaskAccessKind,
  type WriteRefusalTextOf,
  mcpScopeOf,
  registerTaskTools,
} from './mcp-server';
import { NO_TEXT_BYTES, ONE_WRITE, textBytesOf } from './owner-write-quota';
import { canonicalTimeZone } from './time-zone';
import { nameFailureOf } from './write-rules';
import { failureText } from './mcp-format';
import {
  CreateProjectArgumentsSchema,
  DeleteProjectArgumentsSchema,
  DeleteWorkspaceArgumentsSchema,
  NameArgumentsSchema,
  RenameProjectArgumentsSchema,
  RenameWorkspaceArgumentsSchema,
  UpdateSettingsArgumentsSchema,
} from './mcp-owner-arguments';
import { type ActionFailure, ActionFailureKind, type ActionResult } from './owner-action-result';
import type { OwnerRecord, ProjectRecord } from './owner-records';
import { readSettings, updateSettings } from './owner-settings-actions';
import {
  createProject,
  createWorkspace,
  deleteProject,
  deleteWorkspace,
  findConfirmedProject,
  findConfirmedWorkspace,
  renameProject,
  renameWorkspace,
} from './owner-workspace-actions';
import { GrantShape, type SelectionScope, isProjectCovered } from './oauth/oauth-grant-scope';
import {
  type GrantProject,
  type SessionOwner,
  findOwnedProjectId,
  findOwnedWorkspaceId,
  openCoveredGrantProject,
  openOwnedGrantProject,
} from './project-routing';

const MCP_SERVER_NAME = 'todz';
const MCP_SERVER_VERSION = '0.1.0';
const TEXT_CONTENT = 'text';
const LINE_BREAK = '\n';
const PROJECT_INDENT = '  ';
const TIME_PART_WIDTH = 2;

export type OwnerReach = { shape: GrantShape.Owner } | { shape: GrantShape.Selection; scopes: SelectionScope[] };

export type OwnerMcpScope = {
  env: Env;
  owner: SessionOwner;
  reach: OwnerReach;
  now: number;
  limits: FairUseLimits;
  refusalTextOf: WriteRefusalTextOf;
  clientNameOf: ClientNameOf;
};

function grantProjectOf({ scope, projectId }: { scope: OwnerMcpScope; projectId: string }): Promise<GrantProject | null> {
  const { env, owner, reach } = scope;
  if (reach.shape === GrantShape.Owner) return openOwnedGrantProject({ env, owner, projectId });
  return openCoveredGrantProject({ env, owner, projectId, scopes: reach.scopes });
}

async function taskScopeOf({ scope, projectId }: { scope: OwnerMcpScope; projectId: string }): Promise<McpServerScope | null> {
  const { now, clientNameOf, limits, refusalTextOf } = scope;
  const grantProject = await grantProjectOf({ scope, projectId });
  if (grantProject === null) return null;
  return mcpScopeOf({ grantProject, now, clientNameOf, limits, refusalTextOf });
}

async function reserved({
  scope,
  name,
  run,
}: {
  scope: OwnerMcpScope;
  name: string | null;
  run: () => Promise<CallToolResult>;
}): Promise<CallToolResult> {
  const nameFailure = name === null ? null : nameFailureOf(name);
  if (nameFailure !== null) return errorAnswer(failureText(nameFailure));
  const bytes = name === null ? NO_TEXT_BYTES : textBytesOf([name]);
  const refusal = await scope.refusalTextOf({ writes: ONE_WRITE, bytes });
  if (refusal !== null) return errorAnswer(refusal);
  return run();
}

async function reservedForOwned({
  scope,
  findOwnedId,
  name,
  run,
}: {
  scope: OwnerMcpScope;
  findOwnedId: () => Promise<string | null>;
  name: string;
  run: () => Promise<CallToolResult>;
}): Promise<CallToolResult> {
  const ownedId = await findOwnedId();
  if (ownedId === null) return errorAnswer(MCP_COPY.accountNotFound);
  return reserved({ scope, name, run });
}

function textAnswer(text: string): CallToolResult {
  return { content: [{ type: TEXT_CONTENT, text }] };
}

function errorAnswer(text: string): CallToolResult {
  return { content: [{ type: TEXT_CONTENT, text }], isError: true };
}

const TEXT_OF_FIXED_FAILURE: Record<Exclude<ActionFailureKind, ActionFailureKind.RuleViolated | ActionFailureKind.LimitReached>, string> = {
  [ActionFailureKind.NotFound]: MCP_COPY.accountNotFound,
  [ActionFailureKind.InboxIsFixed]: MCP_COPY.inboxIsFixed,
  [ActionFailureKind.TimeZoneInvalid]: MCP_COPY.timeZoneInvalid,
};

function failureTextOf({ failure, limitText }: { failure: ActionFailure; limitText: string | null }): string {
  if (failure.kind === ActionFailureKind.RuleViolated) return failureText(failure.failure);
  if (failure.kind !== ActionFailureKind.LimitReached) return TEXT_OF_FIXED_FAILURE[failure.kind];
  if (limitText === null) throw new Error('only an action with a limit reaches it');
  return limitText;
}

function answerOf<Value>({
  result,
  answer,
  limitText = null,
}: {
  result: ActionResult<Value>;
  answer: (value: Value) => string;
  limitText?: string | null;
}): CallToolResult {
  if (!result.ok) return errorAnswer(failureTextOf({ failure: result.failure, limitText }));
  return textAnswer(answer(result.value));
}

function projectLine(project: ProjectRecord): string {
  const inboxMark = project.isInbox ? MCP_COPY.inboxProject : '';
  return `${PROJECT_INDENT}${project.id} ${project.name}${inboxMark}`;
}

function workspacesAnswer(listings: WorkspaceListing[]): string {
  if (listings.length === 0) return MCP_COPY.noWorkspaces;
  return listings
    .flatMap(({ workspace, projects }) => [`${workspace.id} ${workspace.name}`, ...projects.map(projectLine)])
    .join(LINE_BREAK);
}

function inboxOf(listing: WorkspaceListing): ProjectRecord {
  const inbox = listing.projects.find((project) => project.isInbox);
  if (inbox === undefined) throw new Error('a new workspace has an Inbox');
  return inbox;
}

function dayEmailTimeOf(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const remainder = minutes % MINUTES_PER_HOUR;
  return `${String(hours).padStart(TIME_PART_WIDTH, '0')}:${String(remainder).padStart(TIME_PART_WIDTH, '0')}`;
}

function settingsLines(settings: OwnerRecord): string[] {
  const nudgeState = settings.agentNudge ? MCP_COPY.settingsOn : MCP_COPY.settingsOff;
  const dayEmailLine = settings.dayEmail ? MCP_COPY.dayEmailOnLine(dayEmailTimeOf(settings.dayEmailMinutes)) : MCP_COPY.dayEmailOffLine;
  return [MCP_COPY.timeZoneLine(settings.timeZone), MCP_COPY.agentNudgeLine(nudgeState), dayEmailLine];
}

function coveredListings({ listings, scopes }: { listings: WorkspaceListing[]; scopes: SelectionScope[] }): WorkspaceListing[] {
  return listings.flatMap(({ workspace, projects }) => {
    const covered = projects.filter(({ id }) => isProjectCovered({ scopes, projectId: id, workspaceId: workspace.id }));
    if (covered.length === 0) return [];
    return [{ workspace, projects: covered }];
  });
}

async function reachedListingsOf(scope: OwnerMcpScope): Promise<WorkspaceListing[]> {
  const { env, owner, reach } = scope;
  const listings = await listOwnerWorkspaces({ directory: env.DIRECTORY, ownerId: owner.ownerId });
  if (reach.shape === GrantShape.Owner) return listings;
  return coveredListings({ listings, scopes: reach.scopes });
}

function registerWorkspacesTool({ server, scope }: { server: McpServer; scope: OwnerMcpScope }): void {
  server.registerTool(
    McpOwnerToolName.Workspaces,
    { description: MCP_COPY.ownerTools[McpOwnerToolName.Workspaces], annotations: annotationsOf(McpOwnerToolName.Workspaces) },
    async () => textAnswer(workspacesAnswer(await reachedListingsOf(scope))),
  );
}

function registerSettingsReadTool({ server, scope }: { server: McpServer; scope: OwnerMcpScope }): void {
  const { env, owner } = scope;
  server.registerTool(
    McpOwnerToolName.Settings,
    { description: MCP_COPY.ownerTools[McpOwnerToolName.Settings], annotations: annotationsOf(McpOwnerToolName.Settings) },
    async () => textAnswer(settingsLines(await readSettings({ env, owner })).join(LINE_BREAK)),
  );
}

function registerSettingsTool({ server, scope }: { server: McpServer; scope: OwnerMcpScope }): void {
  const { env, owner, now } = scope;
  server.registerTool(
    McpOwnerToolName.UpdateSettings,
    {
      description: MCP_COPY.ownerTools[McpOwnerToolName.UpdateSettings],
      inputSchema: UpdateSettingsArgumentsSchema,
      annotations: annotationsOf(McpOwnerToolName.UpdateSettings),
    },
    async (args) => {
      const input = {
        timeZone: args.time_zone,
        agentNudge: args.agent_nudge,
        dayEmail: args.day_email,
        dayEmailMinutes: args.day_email_minutes,
      };
      const isEmpty = Object.values(input).every((value) => value === undefined);
      if (isEmpty) return errorAnswer(MCP_COPY.nothingToUpdateSettings);
      const isInvalidTimeZone = input.timeZone !== undefined && canonicalTimeZone(input.timeZone) === null;
      if (isInvalidTimeZone) return errorAnswer(MCP_COPY.timeZoneInvalid);
      return reserved({
        scope,
        name: null,
        run: async () => {
          const result = await updateSettings({ env, owner, now, input });
          return answerOf({ result, answer: (settings) => [MCP_COPY.settingsUpdated, ...settingsLines(settings)].join(LINE_BREAK) });
        },
      });
    },
  );
}

function registerWorkspaceTools({ server, scope }: { server: McpServer; scope: OwnerMcpScope }): void {
  const { env, owner, now } = scope;
  const workspacesPerOwnerMax = scope.limits[FairUseLimit.Workspaces];
  const limitText = MCP_COPY.workspacesLimit(workspacesPerOwnerMax);
  server.registerTool(
    McpOwnerToolName.CreateWorkspace,
    {
      description: MCP_COPY.ownerTools[McpOwnerToolName.CreateWorkspace],
      inputSchema: NameArgumentsSchema,
      annotations: annotationsOf(McpOwnerToolName.CreateWorkspace),
    },
    async ({ name }) =>
      reserved({
        scope,
        name,
        run: async () => {
          const result = await createWorkspace({ env, owner, name, now, workspacesPerOwnerMax });
          const answer = ({ workspace, projects }: WorkspaceListing) =>
            MCP_COPY.workspaceCreated({ id: workspace.id, name: workspace.name, inboxId: inboxOf({ workspace, projects }).id });
          return answerOf({ result, answer, limitText });
        },
      }),
  );
  server.registerTool(
    McpOwnerToolName.RenameWorkspace,
    {
      description: MCP_COPY.ownerTools[McpOwnerToolName.RenameWorkspace],
      inputSchema: RenameWorkspaceArgumentsSchema,
      annotations: annotationsOf(McpOwnerToolName.RenameWorkspace),
    },
    async ({ workspace, name }) =>
      reservedForOwned({
        scope,
        findOwnedId: () => findOwnedWorkspaceId({ env, owner, workspaceId: workspace }),
        name,
        run: async () => {
          const result = await renameWorkspace({ env, owner, workspaceId: workspace, name });
          return answerOf({ result, answer: (listing) => MCP_COPY.workspaceRenamed(listing.workspace), limitText });
        },
      }),
  );
  server.registerTool(
    McpOwnerToolName.DeleteWorkspace,
    {
      description: MCP_COPY.ownerTools[McpOwnerToolName.DeleteWorkspace],
      inputSchema: DeleteWorkspaceArgumentsSchema,
      annotations: annotationsOf(McpOwnerToolName.DeleteWorkspace),
    },
    async ({ workspace, confirm }) => {
      const confirmed = await findConfirmedWorkspace({ env, owner, workspaceId: workspace, confirmation: confirm });
      if (!confirmed.ok) return errorAnswer(failureTextOf({ failure: confirmed.failure, limitText }));
      return reserved({
        scope,
        name: null,
        run: async () => {
          const result = await deleteWorkspace({ env, owner, workspaceId: workspace, expectedName: confirmed.value.workspace.name });
          return answerOf({ result, answer: () => MCP_COPY.workspaceDeleted(confirmed.value.workspace.name), limitText });
        },
      });
    },
  );
}

function registerProjectTools({ server, scope }: { server: McpServer; scope: OwnerMcpScope }): void {
  const { env, owner, now } = scope;
  const projectsPerWorkspaceMax = scope.limits[FairUseLimit.Projects];
  const limitText = MCP_COPY.projectsLimit(projectsPerWorkspaceMax);
  server.registerTool(
    McpOwnerToolName.CreateProject,
    {
      description: MCP_COPY.ownerTools[McpOwnerToolName.CreateProject],
      inputSchema: CreateProjectArgumentsSchema,
      annotations: annotationsOf(McpOwnerToolName.CreateProject),
    },
    async ({ workspace, name }) =>
      reservedForOwned({
        scope,
        findOwnedId: () => findOwnedWorkspaceId({ env, owner, workspaceId: workspace }),
        name,
        run: async () => {
          const result = await createProject({ env, owner, workspaceId: workspace, name, now, projectsPerWorkspaceMax });
          return answerOf({ result, answer: MCP_COPY.projectCreated, limitText });
        },
      }),
  );
  server.registerTool(
    McpOwnerToolName.RenameProject,
    {
      description: MCP_COPY.ownerTools[McpOwnerToolName.RenameProject],
      inputSchema: RenameProjectArgumentsSchema,
      annotations: annotationsOf(McpOwnerToolName.RenameProject),
    },
    async ({ project, name }) =>
      reservedForOwned({
        scope,
        findOwnedId: () => findOwnedProjectId({ env, owner, projectId: project }),
        name,
        run: async () => {
          const result = await renameProject({ env, owner, projectId: project, name });
          return answerOf({ result, answer: MCP_COPY.projectRenamed, limitText });
        },
      }),
  );
  server.registerTool(
    McpOwnerToolName.DeleteProject,
    {
      description: MCP_COPY.ownerTools[McpOwnerToolName.DeleteProject],
      inputSchema: DeleteProjectArgumentsSchema,
      annotations: annotationsOf(McpOwnerToolName.DeleteProject),
    },
    async ({ project, confirm }) => {
      const confirmed = await findConfirmedProject({ env, owner, projectId: project, confirmation: confirm });
      if (!confirmed.ok) return errorAnswer(failureTextOf({ failure: confirmed.failure, limitText }));
      return reserved({
        scope,
        name: null,
        run: async () => {
          const result = await deleteProject({ env, owner, projectId: project, expectedName: confirmed.value.name });
          return answerOf({ result, answer: () => MCP_COPY.projectDeleted(confirmed.value.name), limitText });
        },
      });
    },
  );
}

function registerAccountTools({ server, scope }: { server: McpServer; scope: OwnerMcpScope }): void {
  registerSettingsReadTool({ server, scope });
  registerWorkspaceTools({ server, scope });
  registerProjectTools({ server, scope });
  registerSettingsTool({ server, scope });
}

const INSTRUCTIONS_OF_SHAPE: Record<OwnerReach['shape'], string> = {
  [GrantShape.Owner]: MCP_COPY.ownerInstructions,
  [GrantShape.Selection]: MCP_COPY.selectionInstructions,
};

// NB ADR 0126: only the whole account is offered the owner tools; a selection gets the workspaces it covers and the task tools.
export function buildOwnerMcpServer(scope: OwnerMcpScope): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { instructions: INSTRUCTIONS_OF_SHAPE[scope.reach.shape] },
  );
  registerWorkspacesTool({ server, scope });
  if (scope.reach.shape === GrantShape.Owner) registerAccountTools({ server, scope });
  registerTaskTools({
    server,
    access: { kind: TaskAccessKind.Owner, scopeOf: (projectId) => taskScopeOf({ scope, projectId }) },
  });
  return server;
}
