import { MCP_COPY, McpToolName } from '../mcp-copy';
import { SERVER_CARD_FILE, SERVER_CARD_MEDIA_TYPE } from '../mcp-server-card';
import { AgentClient, agentSetupOf } from './agent-setup';
import { DISCOVERY_COPY, DOCS_PAGES, TOOL_PARAMETERS } from './discovery-copy';
import { type DiscoveryFile, NO_HEADERS, OPEN_READ_HEADERS } from './discovery-response';
import { LANDING_COPY } from './landing-copy';
import { DARK_THEME_COLOR, KEY_PLACEHOLDER } from './site-constants';
import { SITE_ICONS, SiteIcon } from './site-icons';
import { DOCS_URL, DiscoveryPath, MCP_URL, SERVER_CARD_PATH, SITE_URL } from './site-urls';

const FENCE = '```';
const TEXT_TYPE = 'text/plain; charset=utf-8';
const XML_TYPE = 'application/xml; charset=utf-8';
const MANIFEST_TYPE = 'application/manifest+json';
const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const JSON_TYPE = 'application/json';
const CATALOG_IDENTIFIER = 'urn:air:todz.app:mcp:todz';
const MANIFEST_ICONS = [SiteIcon.Icon192, SiteIcon.Icon512, SiteIcon.Maskable192, SiteIcon.Maskable512];
const CRAWLERS = [
  'Googlebot',
  'Bingbot',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
];

function linesOf(lines: string[]): string {
  return `${lines.join('\n')}\n`;
}

function fenced({ language, text }: { language: string; text: string }): string[] {
  return [`${FENCE}${language}`, text, FENCE, ''];
}

function setupOf(client: AgentClient): string {
  return agentSetupOf({ client, serverUrl: MCP_URL, key: KEY_PLACEHOLDER });
}

const ROBOTS_TEXT = linesOf([
  'User-agent: *',
  'Allow: /',
  '',
  ...CRAWLERS.flatMap((crawler) => [`User-agent: ${crawler}`, 'Allow: /', '']),
  `Sitemap: ${SITE_URL}${DiscoveryPath.Sitemap}`,
  `Sitemap: ${DOCS_URL}${DiscoveryPath.Sitemap}`,
]);

const SITEMAP_XML = linesOf([
  '<?xml version="1.0" encoding="UTF-8"?>',
  `<urlset xmlns="${SITEMAP_NAMESPACE}">`,
  `<url><loc>${SITE_URL}/</loc></url>`,
  '</urlset>',
]);

const MANIFEST_JSON = JSON.stringify({
  name: LANDING_COPY.meta.siteName,
  short_name: LANDING_COPY.meta.siteName,
  description: LANDING_COPY.meta.description,
  start_url: '/',
  scope: '/',
  display: 'browser',
  background_color: DARK_THEME_COLOR,
  theme_color: DARK_THEME_COLOR,
  icons: MANIFEST_ICONS.map((icon) => {
    const { path, size, mediaType, purpose } = SITE_ICONS[icon];
    return { src: path, sizes: `${size}x${size}`, type: mediaType, purpose };
  }),
});

const CATALOG_JSON = JSON.stringify({
  entries: [
    {
      identifier: CATALOG_IDENTIFIER,
      displayName: LANDING_COPY.meta.siteName,
      type: SERVER_CARD_MEDIA_TYPE,
      url: new URL(SERVER_CARD_PATH, MCP_URL).href,
      representativeQueries: DISCOVERY_COPY.representativeQueries,
    },
  ],
});

const HEAD_LINES = [
  `# ${LANDING_COPY.meta.siteName}`,
  '',
  `> ${DISCOVERY_COPY.summary}`,
  '',
  DISCOVERY_COPY.status,
  DISCOVERY_COPY.pricing,
  DISCOVERY_COPY.publisher,
  '',
];

const CONNECT_LINES = [
  `## ${DISCOVERY_COPY.connect.heading}`,
  '',
  DISCOVERY_COPY.connect.lead,
  '',
  ...fenced({ language: 'bash', text: setupOf(AgentClient.ClaudeCode) }),
  `- [${DISCOVERY_COPY.connect.setupsLink}](${SITE_URL}${DiscoveryPath.LlmsFull})`,
  '',
];

const SETUP_LINES = [
  `## ${DISCOVERY_COPY.setups.codex}`,
  '',
  ...fenced({ language: 'toml', text: setupOf(AgentClient.Codex) }),
  `## ${DISCOVERY_COPY.setups.cursor}`,
  '',
  ...fenced({ language: 'json', text: setupOf(AgentClient.Cursor) }),
];

const TOOL_LINES = [
  `## ${DISCOVERY_COPY.tools.heading}`,
  '',
  ...Object.values(McpToolName).map((name) => `- \`${name}\`: ${MCP_COPY.tools[name]}`),
  '',
];

const PARAMETER_LINES = [
  `## ${DISCOVERY_COPY.tools.parametersHeading}`,
  '',
  ...Object.values(McpToolName).flatMap((name) =>
    TOOL_PARAMETERS[name].map(({ name: parameter, text }) => `- \`${name}\` \`${parameter}\`: ${text}`),
  ),
  '',
];

const DOCS_LINES = [
  `## ${DISCOVERY_COPY.docs.heading}`,
  '',
  ...DOCS_PAGES.map(({ title, path }) => `- [${title}](${DOCS_URL}${path})`),
  '',
];

const OPTIONAL_LINES = [
  `## ${DISCOVERY_COPY.optional.heading}`,
  '',
  `- [${DISCOVERY_COPY.optional.fullLink}](${SITE_URL}${DiscoveryPath.LlmsFull}): ${DISCOVERY_COPY.optional.fullNote}`,
];

const LLMS_TEXT = linesOf([...HEAD_LINES, ...CONNECT_LINES, ...TOOL_LINES, ...DOCS_LINES, ...OPTIONAL_LINES]);

const LLMS_FULL_TEXT = linesOf([
  ...HEAD_LINES,
  ...CONNECT_LINES,
  ...SETUP_LINES,
  ...TOOL_LINES,
  ...PARAMETER_LINES,
  ...DOCS_LINES,
  ...OPTIONAL_LINES,
]);

export const DISCOVERY_FILES: DiscoveryFile[] = [
  { path: DiscoveryPath.Robots, contentType: TEXT_TYPE, body: ROBOTS_TEXT, headers: NO_HEADERS },
  { path: DiscoveryPath.Sitemap, contentType: XML_TYPE, body: SITEMAP_XML, headers: NO_HEADERS },
  { path: DiscoveryPath.Llms, contentType: TEXT_TYPE, body: LLMS_TEXT, headers: NO_HEADERS },
  { path: DiscoveryPath.LlmsFull, contentType: TEXT_TYPE, body: LLMS_FULL_TEXT, headers: NO_HEADERS },
  { path: DiscoveryPath.Manifest, contentType: MANIFEST_TYPE, body: MANIFEST_JSON, headers: NO_HEADERS },
  { path: DiscoveryPath.Catalog, contentType: JSON_TYPE, body: CATALOG_JSON, headers: OPEN_READ_HEADERS },
  { path: DiscoveryPath.ServerCard, ...SERVER_CARD_FILE },
];
