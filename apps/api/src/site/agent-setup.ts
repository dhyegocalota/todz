const SERVER_NAME = 'todz';
const KEY_VARIABLE = 'TODZ_API_KEY';
const JSON_INDENT = 2;

export enum AgentClient {
  ClaudeCode = 'claude-code',
  Codex = 'codex',
  Cursor = 'cursor',
}

type AgentSetup = { serverUrl: string; key: string };

function claudeCodeSetup({ serverUrl, key }: AgentSetup): string {
  return `claude mcp add --transport http ${SERVER_NAME} '${serverUrl}' --header 'Authorization: Bearer ${key}'`;
}

function codexSetup({ serverUrl, key }: AgentSetup): string {
  return [
    `[mcp_servers.${SERVER_NAME}]`,
    `url = "${serverUrl}"`,
    `bearer_token_env_var = "${KEY_VARIABLE}"`,
    `export ${KEY_VARIABLE}='${key}'`,
  ].join('\n');
}

function cursorSetup({ serverUrl, key }: AgentSetup): string {
  return JSON.stringify(
    { mcpServers: { [SERVER_NAME]: { url: serverUrl, headers: { Authorization: `Bearer ${key}` } } } },
    null,
    JSON_INDENT,
  );
}

const SETUP_OF_CLIENT: Record<AgentClient, (setup: AgentSetup) => string> = {
  [AgentClient.ClaudeCode]: claudeCodeSetup,
  [AgentClient.Codex]: codexSetup,
  [AgentClient.Cursor]: cursorSetup,
};

export function agentSetupOf({ client, serverUrl, key }: { client: AgentClient } & AgentSetup): string {
  return SETUP_OF_CLIENT[client]({ serverUrl, key });
}
