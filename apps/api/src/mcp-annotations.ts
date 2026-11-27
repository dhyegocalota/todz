import type { ToolAnnotations } from '@modelcontextprotocol/server';
import { MCP_COPY, McpOwnerToolName, McpToolName } from './mcp-copy';

enum ToolEffect {
  Read = 'read',
  Create = 'create',
  Change = 'change',
  Overwrite = 'overwrite',
  Remove = 'remove',
  Relocate = 'relocate',
}

type ToolName = McpToolName | McpOwnerToolName;

const CLOSED_WORLD_HINT = { openWorldHint: false };

const HINTS_OF_EFFECT: Record<ToolEffect, Pick<ToolAnnotations, 'readOnlyHint' | 'destructiveHint' | 'idempotentHint'>> = {
  [ToolEffect.Read]: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  [ToolEffect.Create]: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  [ToolEffect.Change]: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  [ToolEffect.Overwrite]: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  [ToolEffect.Remove]: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  [ToolEffect.Relocate]: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
};

const EFFECT_OF_TOOL: Record<ToolName, ToolEffect> = {
  [McpToolName.Next]: ToolEffect.Read,
  [McpToolName.Add]: ToolEffect.Create,
  [McpToolName.List]: ToolEffect.Read,
  [McpToolName.Show]: ToolEffect.Read,
  [McpToolName.History]: ToolEffect.Read,
  [McpToolName.Update]: ToolEffect.Overwrite,
  [McpToolName.Done]: ToolEffect.Change,
  [McpToolName.Reopen]: ToolEffect.Change,
  [McpToolName.Delete]: ToolEffect.Remove,
  [McpToolName.Move]: ToolEffect.Relocate,
  [McpToolName.Projects]: ToolEffect.Read,
  [McpOwnerToolName.Workspaces]: ToolEffect.Read,
  [McpOwnerToolName.CreateWorkspace]: ToolEffect.Create,
  [McpOwnerToolName.RenameWorkspace]: ToolEffect.Overwrite,
  [McpOwnerToolName.DeleteWorkspace]: ToolEffect.Remove,
  [McpOwnerToolName.CreateProject]: ToolEffect.Create,
  [McpOwnerToolName.RenameProject]: ToolEffect.Overwrite,
  [McpOwnerToolName.DeleteProject]: ToolEffect.Remove,
  [McpOwnerToolName.Settings]: ToolEffect.Read,
  [McpOwnerToolName.UpdateSettings]: ToolEffect.Overwrite,
};

export function annotationsOf(tool: ToolName): ToolAnnotations {
  return { title: MCP_COPY.titles[tool], ...HINTS_OF_EFFECT[EFFECT_OF_TOOL[tool]], ...CLOSED_WORLD_HINT };
}
