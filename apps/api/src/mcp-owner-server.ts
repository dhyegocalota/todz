import { type CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { OWNER_WORKSPACES_MAX, WORKSPACE_PROJECTS_MAX } from '@todz/types';
import { type WorkspaceListing, listOwnerWorkspaces } from './directory-workspaces';
import type { Env } from './env';
import { MCP_COPY, McpOwnerToolName } from './mcp-copy';
import { failureText } from './mcp-format';
import {
  CreateProjectArgumentsSchema,
  DeleteProjectArgumentsSchema,
  DeleteWorkspaceArgumentsSchema,
  NameArgumentsSchema,
  RenameProjectArgumentsSchema,
  RenameWorkspaceArgumentsSchema,
} from './mcp-owner-arguments';
import type { ProjectRecord } from './owner-records';
import {
  type ActionFailure,
  ActionFailureKind,
  type ActionResult,
  createProject,
  createWorkspace,
  deleteProject,
  deleteWorkspace,
  findConfirmedProject,
  findConfirmedWorkspace,
  renameProject,
  renameWorkspace,
} from './owner-workspace-actions';
import type { SessionOwner } from './project-routing';

const MCP_SERVER_NAME = 'todz';
const MCP_SERVER_VERSION = '0.1.0';
const TEXT_CONTENT = 'text';
const LINE_BREAK = '\n';
const PROJECT_INDENT = '  ';
const READ_ONLY_ANNOTATIONS = { readOnlyHint: true };
const WRITE_ANNOTATIONS = { destructiveHint: false };
const DESTRUCTIVE_ANNOTATIONS = { destructiveHint: true };

export type OwnerMcpScope = { env: Env; owner: SessionOwner; now: number };

function textAnswer(text: string): CallToolResult {
  return { content: [{ type: TEXT_CONTENT, text }] };
}

function errorAnswer(text: string): CallToolResult {
  return { content: [{ type: TEXT_CONTENT, text }], isError: true };
}

function failureTextOf({ failure, limitText }: { failure: ActionFailure; limitText: string }): string {
  if (failure.kind === ActionFailureKind.RuleViolated) return failureText(failure.failure);
  if (failure.kind === ActionFailureKind.NotFound) return MCP_COPY.accountNotFound;
  if (failure.kind === ActionFailureKind.InboxIsFixed) return MCP_COPY.inboxIsFixed;
  return limitText;
}

function answerOf<Value>({
  result,
  answer,
  limitText,
}: {
  result: ActionResult<Value>;
  answer: (value: Value) => string;
  limitText: string;
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

function registerReadTools({ server, scope }: { server: McpServer; scope: OwnerMcpScope }): void {
  server.registerTool(
    McpOwnerToolName.Workspaces,
    { description: MCP_COPY.ownerTools[McpOwnerToolName.Workspaces], annotations: READ_ONLY_ANNOTATIONS },
    async () => textAnswer(workspacesAnswer(await listOwnerWorkspaces({ directory: scope.env.DIRECTORY, ownerId: scope.owner.ownerId }))),
  );
}

function registerWorkspaceTools({ server, scope }: { server: McpServer; scope: OwnerMcpScope }): void {
  const { env, owner, now } = scope;
  const limitText = MCP_COPY.workspacesLimit(OWNER_WORKSPACES_MAX);
  server.registerTool(
    McpOwnerToolName.CreateWorkspace,
    {
      description: MCP_COPY.ownerTools[McpOwnerToolName.CreateWorkspace],
      inputSchema: NameArgumentsSchema,
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ name }) => {
      const result = await createWorkspace({ env, owner, name, now, workspacesPerOwnerMax: OWNER_WORKSPACES_MAX });
      const answer = ({ workspace, projects }: WorkspaceListing) =>
        MCP_COPY.workspaceCreated({ id: workspace.id, name: workspace.name, inboxId: inboxOf({ workspace, projects }).id });
      return answerOf({ result, answer, limitText });
    },
  );
  server.registerTool(
    McpOwnerToolName.RenameWorkspace,
    {
      description: MCP_COPY.ownerTools[McpOwnerToolName.RenameWorkspace],
      inputSchema: RenameWorkspaceArgumentsSchema,
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ workspace, name }) => {
      const result = await renameWorkspace({ env, owner, workspaceId: workspace, name });
      return answerOf({ result, answer: (listing) => MCP_COPY.workspaceRenamed(listing.workspace), limitText });
    },
  );
  server.registerTool(
    McpOwnerToolName.DeleteWorkspace,
    {
      description: MCP_COPY.ownerTools[McpOwnerToolName.DeleteWorkspace],
      inputSchema: DeleteWorkspaceArgumentsSchema,
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ workspace, confirm }) => {
      const confirmed = await findConfirmedWorkspace({ env, owner, workspaceId: workspace, confirmation: confirm });
      if (!confirmed.ok) return errorAnswer(failureTextOf({ failure: confirmed.failure, limitText }));
      const result = await deleteWorkspace({ env, owner, workspaceId: workspace });
      return answerOf({ result, answer: () => MCP_COPY.workspaceDeleted(confirmed.value.workspace.name), limitText });
    },
  );
}

function registerProjectTools({ server, scope }: { server: McpServer; scope: OwnerMcpScope }): void {
  const { env, owner, now } = scope;
  const limitText = MCP_COPY.projectsLimit(WORKSPACE_PROJECTS_MAX);
  server.registerTool(
    McpOwnerToolName.CreateProject,
    {
      description: MCP_COPY.ownerTools[McpOwnerToolName.CreateProject],
      inputSchema: CreateProjectArgumentsSchema,
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ workspace, name }) => {
      const result = await createProject({
        env,
        owner,
        workspaceId: workspace,
        name,
        now,
        projectsPerWorkspaceMax: WORKSPACE_PROJECTS_MAX,
      });
      return answerOf({ result, answer: MCP_COPY.projectCreated, limitText });
    },
  );
  server.registerTool(
    McpOwnerToolName.RenameProject,
    {
      description: MCP_COPY.ownerTools[McpOwnerToolName.RenameProject],
      inputSchema: RenameProjectArgumentsSchema,
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ project, name }) => {
      const result = await renameProject({ env, owner, projectId: project, name });
      return answerOf({ result, answer: MCP_COPY.projectRenamed, limitText });
    },
  );
  server.registerTool(
    McpOwnerToolName.DeleteProject,
    {
      description: MCP_COPY.ownerTools[McpOwnerToolName.DeleteProject],
      inputSchema: DeleteProjectArgumentsSchema,
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ project, confirm }) => {
      const confirmed = await findConfirmedProject({ env, owner, projectId: project, confirmation: confirm });
      if (!confirmed.ok) return errorAnswer(failureTextOf({ failure: confirmed.failure, limitText }));
      const result = await deleteProject({ env, owner, projectId: project });
      return answerOf({ result, answer: () => MCP_COPY.projectDeleted(confirmed.value.name), limitText });
    },
  );
}

export function buildOwnerMcpServer(scope: OwnerMcpScope): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION }, { instructions: MCP_COPY.ownerInstructions });
  registerReadTools({ server, scope });
  registerWorkspaceTools({ server, scope });
  registerProjectTools({ server, scope });
  return server;
}
