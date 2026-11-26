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

export const DeleteProjectArgumentsSchema = z.object({
  project: z.string().describe(ownerFields.project),
  confirm: z.string().describe(ownerFields.confirmProject),
});
