import { enumValueOf } from '../enum-value';

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

const VERSION_DIMENSION_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\|(?:\d{1,2}|unknown)$/;

const MARKER_OF_AGENT_CLIENT: Record<Exclude<AgentClient, AgentClient.Other>, string> = {
  [AgentClient.ClaudeCode]: 'claude',
  [AgentClient.Codex]: 'codex',
  [AgentClient.Cursor]: 'cursor',
  [AgentClient.Gemini]: 'gemini',
  [AgentClient.Windsurf]: 'windsurf',
  [AgentClient.Zed]: 'zed',
  [AgentClient.Vscode]: 'vscode',
};

export function agentClientOf(clientName: string): AgentClient {
  const lowered = clientName.toLowerCase();
  const knownClients = Object.entries(MARKER_OF_AGENT_CLIENT) as [AgentClient, string][];
  const known = knownClients.find(([, marker]) => lowered.includes(marker));
  if (known === undefined) return AgentClient.Other;
  return known[0];
}

function enumDimensionOf({ enumeration, candidate }: { enumeration: Record<string, string>; candidate: string }): string {
  const value = enumValueOf({ enumeration, candidate });
  if (value === null) return OTHER_DIMENSION;
  return value;
}

function versionDimensionOf(candidate: string): string {
  if (VERSION_DIMENSION_PATTERN.test(candidate)) return candidate;
  return OTHER_DIMENSION;
}

const DIMENSION_OF_METRIC: Record<Metric, (candidate: string) => string> = {
  [Metric.OwnersTotal]: () => NO_DIMENSION,
  [Metric.OwnersNew]: () => NO_DIMENSION,
  [Metric.WorkspacesTotal]: () => NO_DIMENSION,
  [Metric.WorkspacesNew]: () => NO_DIMENSION,
  [Metric.ProjectsTotal]: () => NO_DIMENSION,
  [Metric.ProjectsNew]: () => NO_DIMENSION,
  [Metric.TasksAdded]: () => NO_DIMENSION,
  [Metric.TasksCompleted]: () => NO_DIMENSION,
  [Metric.AgentWrites]: agentClientOf,
  [Metric.DayMailsSent]: () => NO_DIMENSION,
  [Metric.AppcastRequests]: versionDimensionOf,
  [Metric.UsageRollups]: () => NO_DIMENSION,
  [Metric.UsageVersions]: versionDimensionOf,
  [Metric.UsageEvents]: (candidate) => enumDimensionOf({ enumeration: UsageEvent, candidate }),
};

export function dimensionOf({ metric, candidate }: { metric: Metric; candidate: string }): string {
  return DIMENSION_OF_METRIC[metric](candidate);
}
