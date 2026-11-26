import { AgentClient, agentSetupOf } from './agent-setup';
import { DISCOVERY_COPY, DOCS_PAGES } from './discovery-copy';
import { KEY_PLACEHOLDER, scriptJson } from './site-constants';
import { DOCS_URL, MCP_URL } from './site-urls';
import { WEBMCP_COPY, WebMcpToolName } from './webmcp-copy';

const PARAGRAPH_SEPARATOR = '\n\n';

export type WebMcpProperty = { type: 'string'; description: string; enum?: string[] };

export type WebMcpTool = {
  name: WebMcpToolName;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, WebMcpProperty>; required: string[]; additionalProperties: false };
  annotations: { readOnlyHint: boolean };
};

function schemaOf({ properties, required }: { properties: Record<string, WebMcpProperty>; required: string[] }): WebMcpTool['inputSchema'] {
  return { type: 'object', properties, required, additionalProperties: false };
}

export const WEBMCP_TOOLS: WebMcpTool[] = [
  {
    name: WebMcpToolName.Overview,
    description: WEBMCP_COPY.descriptions[WebMcpToolName.Overview],
    inputSchema: schemaOf({ properties: {}, required: [] }),
    annotations: { readOnlyHint: true },
  },
  {
    name: WebMcpToolName.Setup,
    description: WEBMCP_COPY.descriptions[WebMcpToolName.Setup],
    inputSchema: schemaOf({
      properties: { client: { type: 'string', description: WEBMCP_COPY.fields.client, enum: Object.values(AgentClient) } },
      required: ['client'],
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: WebMcpToolName.Docs,
    description: WEBMCP_COPY.descriptions[WebMcpToolName.Docs],
    inputSchema: schemaOf({
      properties: { page: { type: 'string', description: WEBMCP_COPY.fields.page, enum: DOCS_PAGES.map(({ slug }) => slug) } },
      required: ['page'],
    }),
    annotations: { readOnlyHint: true },
  },
];

const OVERVIEW_TEXT = [
  DISCOVERY_COPY.summary,
  DISCOVERY_COPY.status,
  DISCOVERY_COPY.download,
  DISCOVERY_COPY.pricing,
  DISCOVERY_COPY.publisher,
  `Docs: ${DOCS_URL}`,
].join(PARAGRAPH_SEPARATOR);

const SETUP_OF_CLIENT = Object.fromEntries(
  Object.values(AgentClient).map((client) => [
    client,
    [agentSetupOf({ client, serverUrl: MCP_URL, key: KEY_PLACEHOLDER }), WEBMCP_COPY.keyNote].join(PARAGRAPH_SEPARATOR),
  ]),
);

const ADDRESS_OF_DOCS_PAGE = Object.fromEntries(DOCS_PAGES.map(({ slug, path }) => [slug, `${DOCS_URL}${path}`]));

export const WEBMCP_SCRIPT = `{
  const tools = ${scriptJson(WEBMCP_TOOLS)};
  const answers = ${scriptJson(WEBMCP_COPY.answers)};
  const overview = ${scriptJson(OVERVIEW_TEXT)};
  const setupOfClient = ${scriptJson(SETUP_OF_CLIENT)};
  const addressOfDocsPage = ${scriptJson(ADDRESS_OF_DOCS_PAGE)};
  const textOf = (text) => ({ content: [{ type: 'text', text }] });
  const openDocs = ({ page }) => {
    if (!Object.hasOwn(addressOfDocsPage, page)) return textOf(answers.unknownPage);
    location.href = addressOfDocsPage[page];
    return textOf(addressOfDocsPage[page]);
  };
  const getMcpSetup = ({ client }) => {
    if (!Object.hasOwn(setupOfClient, client)) return textOf(answers.unknownClient);
    return textOf(setupOfClient[client]);
  };
  const executeOfTool = {
    ${WebMcpToolName.Overview}: () => textOf(overview),
    ${WebMcpToolName.Setup}: getMcpSetup,
    ${WebMcpToolName.Docs}: openDocs,
  };
  const modelContext = document.modelContext || navigator.modelContext;
  if (modelContext) {
    tools.forEach((tool) => {
      try {
        Promise.resolve(modelContext.registerTool({ ...tool, execute: (input) => executeOfTool[tool.name](input) })).catch(() => {});
      } catch (error) {}
    });
  }
}`;
