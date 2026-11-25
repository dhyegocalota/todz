export enum AgentClient {
  ClaudeCode = 'claude-code',
  Codex = 'codex',
  Cursor = 'cursor',
}

export function agentSetupOf(_setup: { client: AgentClient; serverUrl: string; key: string }): string {
  throw new Error('agentSetup is not implemented');
}
