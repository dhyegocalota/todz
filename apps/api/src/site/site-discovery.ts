import { LANGUAGE_PROFILES, Language } from '@todz/types';
import { MCP_COPY, McpToolName } from '../mcp-copy';
import { publicPathOf } from './language-paths';
import { SERVER_CARD_FILE, SERVER_CARD_MEDIA_TYPE } from '../mcp-server-card';
import { AgentClient, agentSetupOf } from './agent-setup';
import { DISCOVERY_COPY, DOCS_PAGES, TOOL_PARAMETERS } from './discovery-copy';
import { type DiscoveryFile, NO_HEADERS, OPEN_READ_HEADERS } from './discovery-response';
import { LANDING_COPY } from './landing-copy';
import { LANDING_DAY_LINES, LANDING_LOCK_LINE } from './landing-lines';
import { LANDING_MARKDOWN_FILE } from './landing-markdown';
import { fenced, linesOf } from './markdown-lines';
import { DOCS_SELF_HOST_URL } from './self-host-redirect';
import { DARK_THEME_COLOR } from './site-constants';
import { SITE_ICONS, SiteIcon } from './site-icons';
import { DOCS_MCP_URL, DOCS_URL, DiscoveryPath, LANDING_PATH, MCP_URL, SERVER_CARD_PATH, SITE_URL } from './site-urls';

const PLAIN_TYPE = 'text/plain';
const HTML_TYPE = 'text/html';
const TEXT_TYPE = `${PLAIN_TYPE}; charset=utf-8`;
const LINKSET_TYPE = 'application/linkset+json';
const XML_TYPE = 'application/xml; charset=utf-8';
const MANIFEST_TYPE = 'application/manifest+json';
const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const JSON_TYPE = 'application/json';
const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
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
  'CCBot',
];

function setupOf(client: AgentClient): string {
  return agentSetupOf({ client, serverUrl: MCP_URL });
}

const ROBOTS_TEXT = linesOf([
  'User-agent: *',
  'Allow: /',
  '',
  ...CRAWLERS.flatMap((crawler) => [`User-agent: ${crawler}`, 'Allow: /', '']),
  `Sitemap: ${SITE_URL}${DiscoveryPath.Sitemap}`,
  `Sitemap: ${DOCS_URL}${DiscoveryPath.Sitemap}`,
]);

const SITEMAP_ALTERNATES = [
  ...Object.values(Language).map((language) => ({
    hreflang: LANGUAGE_PROFILES[language].htmlLang,
    href: `${SITE_URL}${publicPathOf({ language, path: LANDING_PATH })}`,
  })),
  { hreflang: 'x-default', href: `${SITE_URL}${publicPathOf({ language: Language.English, path: LANDING_PATH })}` },
];

const SITEMAP_ALTERNATE_LINKS = SITEMAP_ALTERNATES.map(
  ({ hreflang, href }) => `<xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}"/>`,
).join('');

const SITEMAP_XML = linesOf([
  '<?xml version="1.0" encoding="UTF-8"?>',
  `<urlset xmlns="${SITEMAP_NAMESPACE}" xmlns:xhtml="${XHTML_NAMESPACE}">`,
  ...Object.values(Language).map(
    (language) => `<url><loc>${SITE_URL}${publicPathOf({ language, path: LANDING_PATH })}</loc>${SITEMAP_ALTERNATE_LINKS}</url>`,
  ),
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

const API_CATALOG_JSON = JSON.stringify({
  linkset: [
    {
      anchor: MCP_URL,
      'service-desc': [{ href: `${SITE_URL}${DiscoveryPath.ServerCard}`, type: SERVER_CARD_MEDIA_TYPE }],
      'service-doc': [
        { href: DOCS_URL, type: HTML_TYPE },
        { href: `${SITE_URL}${DiscoveryPath.Llms}`, type: PLAIN_TYPE },
      ],
    },
    { anchor: DOCS_MCP_URL, 'service-doc': [{ href: DOCS_URL, type: HTML_TYPE }] },
  ],
});

const HEAD_LINES = [
  `# ${LANDING_COPY.meta.siteName}`,
  '',
  `> ${DISCOVERY_COPY.summary}`,
  '',
  DISCOVERY_COPY.status,
  DISCOVERY_COPY.download,
  DISCOVERY_COPY.pricing,
  DISCOVERY_COPY.publisher,
  DISCOVERY_COPY.source,
  '',
  LANDING_COPY.benefits.day.title,
  ...LANDING_DAY_LINES,
  LANDING_COPY.benefits.day.note,
  '',
  LANDING_COPY.benefits.lock.title,
  LANDING_LOCK_LINE,
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

const SETUP_LINES = [`## ${DISCOVERY_COPY.setups.codex}`, '', ...fenced({ language: 'toml', text: setupOf(AgentClient.Codex) })];

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

const SELF_HOST_LINES = [
  `## ${DISCOVERY_COPY.selfHost.heading}`,
  '',
  `- [${DISCOVERY_COPY.selfHost.linkText}](${DOCS_SELF_HOST_URL}): ${DISCOVERY_COPY.selfHost.note}`,
  '',
];

const DOCS_LINES = [
  `## ${DISCOVERY_COPY.docs.heading}`,
  '',
  ...DOCS_PAGES.map(({ title, path }) => `- [${title}](${DOCS_URL}${path})`),
  '',
];

const DOCS_MCP_LINES = [
  `## ${DISCOVERY_COPY.docsMcp.heading}`,
  '',
  DISCOVERY_COPY.docsMcp.lead,
  '',
  ...fenced({ language: 'bash', text: DISCOVERY_COPY.docsMcp.command }),
];

const OPTIONAL_LINES = [
  `## ${DISCOVERY_COPY.optional.heading}`,
  '',
  `- [${DISCOVERY_COPY.optional.fullLink}](${SITE_URL}${DiscoveryPath.LlmsFull}): ${DISCOVERY_COPY.optional.fullNote}`,
];

const LLMS_TEXT = linesOf([
  ...HEAD_LINES,
  ...CONNECT_LINES,
  ...TOOL_LINES,
  ...SELF_HOST_LINES,
  ...DOCS_LINES,
  ...DOCS_MCP_LINES,
  ...OPTIONAL_LINES,
]);

const LLMS_FULL_TEXT = linesOf([
  ...HEAD_LINES,
  ...CONNECT_LINES,
  ...SETUP_LINES,
  ...TOOL_LINES,
  ...PARAMETER_LINES,
  ...SELF_HOST_LINES,
  ...DOCS_LINES,
  ...DOCS_MCP_LINES,
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
  { path: DiscoveryPath.ApiCatalog, contentType: LINKSET_TYPE, body: API_CATALOG_JSON, headers: OPEN_READ_HEADERS },
  { path: DiscoveryPath.LandingMarkdown, ...LANDING_MARKDOWN_FILE, headers: NO_HEADERS },
];
