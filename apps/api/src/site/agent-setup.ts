const SERVER_NAME = 'todz';

export enum AgentClient {
  ClaudeCode = 'claude-code',
  Codex = 'codex',
}

type AgentSetup = { serverUrl: string };

function claudeCodeSetup({ serverUrl }: AgentSetup): string {
  return `claude mcp add --transport http ${SERVER_NAME} ${serverUrl}`;
}

function codexSetup({ serverUrl }: AgentSetup): string {
  return [`[mcp_servers.${SERVER_NAME}]`, `url = "${serverUrl}"`, `codex mcp login ${SERVER_NAME}`].join('\n');
}

const SETUP_OF_CLIENT: Record<AgentClient, (setup: AgentSetup) => string> = {
  [AgentClient.ClaudeCode]: claudeCodeSetup,
  [AgentClient.Codex]: codexSetup,
};

export function agentSetupOf({ client, serverUrl }: { client: AgentClient } & AgentSetup): string {
  return SETUP_OF_CLIENT[client]({ serverUrl });
}
