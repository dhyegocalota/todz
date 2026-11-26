import { DAY_EMAIL_MINUTES_MAX } from '@todz/types';
import { z } from 'zod';
import { MCP_COPY } from './mcp-copy';

const { ownerFields } = MCP_COPY;

export const NameArgumentsSchema = z.object({ name: z.string().describe(ownerFields.name) });

export const RenameWorkspaceArgumentsSchema = z.object({
  workspace: z.string().describe(ownerFields.workspace),
  name: z.string().describe(ownerFields.name),
});

export const DeleteWorkspaceArgumentsSchema = z.object({
  workspace: z.string().describe(ownerFields.workspace),
  confirm: z.string().describe(ownerFields.confirmWorkspace),
});

export const CreateProjectArgumentsSchema = z.object({
  workspace: z.string().describe(ownerFields.workspace),
  name: z.string().describe(ownerFields.name),
});

export const RenameProjectArgumentsSchema = z.object({
  project: z.string().describe(ownerFields.project),
  name: z.string().describe(ownerFields.name),
});

export const UpdateSettingsArgumentsSchema = z.object({
  time_zone: z.string().optional().describe(ownerFields.timeZone),
  agent_nudge: z.boolean().optional().describe(ownerFields.agentNudge),
  day_email: z.boolean().optional().describe(ownerFields.dayEmail),
  day_email_minutes: z.number().int().min(0).max(DAY_EMAIL_MINUTES_MAX).optional().describe(ownerFields.dayEmailMinutes),
});

export const DeleteProjectArgumentsSchema = z.object({
  project: z.string().describe(ownerFields.project),
  confirm: z.string().describe(ownerFields.confirmProject),
});
