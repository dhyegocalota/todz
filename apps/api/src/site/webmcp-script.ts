import { MILLISECONDS_PER_SECOND } from '@todz/types';
import { AgentClient, agentSetupOf } from './agent-setup';
import { DISCOVERY_COPY, DOCS_PAGES } from './discovery-copy';
import {
  EMAIL_FIELD_NAME,
  JOIN_FORM_CLASS,
  JOIN_STATE_ATTRIBUTE,
  JoinFormState,
  JoinOutcome,
  UNREACHABLE_ANSWER,
  WAITLIST_ANSWERED_EVENT,
} from './join-form-markup';
import { KEY_PLACEHOLDER, scriptJson } from './site-constants';
import { DOCS_URL, MCP_URL } from './site-urls';
import { WEBMCP_COPY, WebMcpToolName } from './webmcp-copy';

const PARAGRAPH_SEPARATOR = '\n\n';
export const WEBMCP_CHECK_WAIT_MS = 30 * MILLISECONDS_PER_SECOND;

export type WebMcpProperty = { type: 'string'; description: string; enum?: string[]; format?: string };

export type WebMcpTool = {
  name: WebMcpToolName;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, WebMcpProperty>; required: string[]; additionalProperties: false };
  annotations: { readOnlyHint?: boolean; consequentialHint?: boolean };
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
  {
    name: WebMcpToolName.Join,
    description: WEBMCP_COPY.descriptions[WebMcpToolName.Join],
    inputSchema: schemaOf({
      properties: { email: { type: 'string', format: 'email', description: WEBMCP_COPY.fields.email } },
      required: ['email'],
    }),
    annotations: { consequentialHint: true },
  },
];

const JOIN_ANSWER_OF_OUTCOME = {
  [JoinOutcome.Joined]: WEBMCP_COPY.answers.joined,
  [JoinOutcome.Invalid]: WEBMCP_COPY.answers.invalid,
  [JoinOutcome.CheckFailed]: WEBMCP_COPY.answers.checkFailed,
  [JoinOutcome.TryAgain]: WEBMCP_COPY.answers.tryAgain,
  [JoinOutcome.OpensSoon]: WEBMCP_COPY.answers.opensSoon,
  [UNREACHABLE_ANSWER]: WEBMCP_COPY.answers.unreachable,
};

const OVERVIEW_TEXT = [
  DISCOVERY_COPY.summary,
  DISCOVERY_COPY.status,
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
  const answerOfOutcome = ${scriptJson(JOIN_ANSWER_OF_OUTCOME)};
  const overview = ${scriptJson(OVERVIEW_TEXT)};
  const setupOfClient = ${scriptJson(SETUP_OF_CLIENT)};
  const addressOfDocsPage = ${scriptJson(ADDRESS_OF_DOCS_PAGE)};
  const textOf = (text) => ({ content: [{ type: 'text', text }] });
  const isForm = (form, current) => form.dataset.${JOIN_STATE_ATTRIBUTE} === current;
  const readyWithin = ({ form, waitMs }) => new Promise((resolve) => {
    const finish = (isReady) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(isReady);
    };
    const observer = new MutationObserver(() => {
      if (isForm(form, '${JoinFormState.Ready}')) finish(true);
    });
    const timer = setTimeout(() => finish(false), waitMs);
    observer.observe(form, { attributes: true });
  });
  const joinWaitlist = async ({ email }) => {
    const form = document.querySelector('.${JOIN_FORM_CLASS}');
    const field = form.querySelector('[name="${EMAIL_FIELD_NAME}"]');
    if (isForm(form, '${JoinFormState.Sending}')) return textOf(answers.alreadySubmitting);
    const typedValue = field.value;
    field.value = email;
    if (!field.checkValidity()) {
      field.value = typedValue;
      return textOf(answers.invalid);
    }
    const isReady = isForm(form, '${JoinFormState.Ready}') || await readyWithin({ form, waitMs: ${WEBMCP_CHECK_WAIT_MS} });
    if (!isReady) return textOf(answers.checkTimedOut);
    if (isForm(form, '${JoinFormState.Sending}')) return textOf(answers.alreadySubmitting);
    const answered = new Promise((resolve) => form.addEventListener('${WAITLIST_ANSWERED_EVENT}', (event) => resolve(event.detail.outcome), { once: true }));
    form.requestSubmit();
    return textOf(answerOfOutcome[await answered]);
  };
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
    ${WebMcpToolName.Join}: joinWaitlist,
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
