export enum WebMcpToolName {
  Overview = 'get_todz_overview',
  Setup = 'get_mcp_setup',
  Docs = 'open_docs',
}

export const WEBMCP_COPY = {
  descriptions: {
    [WebMcpToolName.Overview]: 'What todz is, its status and pricing, who makes it and where its docs are.',
    [WebMcpToolName.Setup]:
      'How to connect an agent to todz over MCP: the command or config for Claude Code or Codex, which then sign in with OAuth.',
    [WebMcpToolName.Docs]: 'Open a page of the todz docs in this tab.',
  } satisfies Record<WebMcpToolName, string>,
  fields: {
    client: 'The agent to set up.',
    page: 'The docs page to open.',
  },
  signInNote: 'The client opens your browser to sign in with OAuth. There is no key to copy.',
  answers: {
    unknownClient: 'That agent is not supported.',
    unknownPage: 'That docs page does not exist.',
  },
};
