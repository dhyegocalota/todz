export type WebMcpProperty = { type: 'string'; description: string; enum?: string[] };

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, WebMcpProperty>; required: string[]; additionalProperties: false };
  annotations: { readOnlyHint?: boolean; consequentialHint?: boolean };
};

export const WEBMCP_TOOLS: WebMcpTool[] = [];

export const WEBMCP_SCRIPT = '';
