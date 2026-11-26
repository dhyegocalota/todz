export enum Metric {
  OwnersTotal = 'owners_total',
  OwnersNew = 'owners_new',
  WorkspacesTotal = 'workspaces_total',
  WorkspacesNew = 'workspaces_new',
  ProjectsTotal = 'projects_total',
  ProjectsNew = 'projects_new',
  TasksAdded = 'tasks_added',
  TasksCompleted = 'tasks_completed',
  AgentWrites = 'agent_writes',
  DayMailsSent = 'day_mails_sent',
  AppcastRequests = 'appcast_requests',
  UsageRollups = 'usage_rollups',
  UsageVersions = 'usage_versions',
  UsageEvents = 'usage_events',
}

export enum UsageEvent {
  PopoverOpened = 'popover_opened',
  DayClosed = 'day_closed',
  MorningGlance = 'morning_glance',
  ShortcutUsed = 'shortcut_used',
  MultiWorkspace = 'multi_workspace',
}

export enum AgentClient {
  ClaudeCode = 'claude-code',
  Codex = 'codex',
  Cursor = 'cursor',
  Gemini = 'gemini',
  Windsurf = 'windsurf',
  Zed = 'zed',
  Vscode = 'vscode',
  Other = 'other',
}

export const NO_DIMENSION = '';
export const OTHER_DIMENSION = 'other';
export const UNKNOWN_MACOS = 'unknown';
export const DIMENSION_SEPARATOR = '|';

export function agentClientOf(clientName: string): AgentClient {
  throw new Error('agentClientOf is not implemented');
}

export function dimensionOf({ metric, candidate }: { metric: Metric; candidate: string }): string {
  throw new Error('dimensionOf is not implemented');
}
