export enum WebMcpToolName {
  Overview = 'get_todz_overview',
  Setup = 'get_mcp_setup',
  Docs = 'open_docs',
  Join = 'join_waitlist',
}

export const WEBMCP_COPY = {
  descriptions: {
    [WebMcpToolName.Overview]: '',
    [WebMcpToolName.Setup]: '',
    [WebMcpToolName.Docs]: '',
    [WebMcpToolName.Join]: '',
  } satisfies Record<WebMcpToolName, string>,
  fields: { client: '', page: '', email: '' },
  keyNote: '',
  answers: { alreadySubmitting: '', invalid: '', sent: '', unknownPage: '' },
};
