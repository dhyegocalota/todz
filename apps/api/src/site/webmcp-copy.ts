export enum WebMcpToolName {
  Overview = 'get_todz_overview',
  Setup = 'get_mcp_setup',
  Docs = 'open_docs',
  Join = 'join_waitlist',
}

export const WEBMCP_COPY = {
  descriptions: {
    [WebMcpToolName.Overview]: 'What todz is, its status and pricing, who makes it and where its docs are.',
    [WebMcpToolName.Setup]:
      'How to connect an agent to todz over MCP: the command or config for Claude Code, Codex or Cursor, with a placeholder for the key.',
    [WebMcpToolName.Docs]: 'Open a page of the todz docs in this tab.',
    [WebMcpToolName.Join]:
      'Join the todz waitlist with an email address. The page may ask the person for a quick human check before it sends.',
  } satisfies Record<WebMcpToolName, string>,
  fields: {
    client: 'The agent to set up.',
    page: 'The docs page to open.',
    email: 'The email address to put on the waitlist.',
  },
  keyNote: 'Replace <key> with a key from Connect an Agent in the app: one key per project.',
  answers: {
    alreadySubmitting: 'The waitlist form is already submitting.',
    invalid: 'That is not a valid email address.',
    sent: 'The form was submitted. The page may ask the person for a quick human check before it finishes, and then shows the result.',
    unknownClient: 'That agent is not supported.',
    unknownPage: 'That docs page does not exist.',
  },
};
