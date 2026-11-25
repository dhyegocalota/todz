import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/server';
import { HttpMethod } from './http-method';
import { MCP_SERVER_VERSION } from './mcp-server';
import { noRouteResponse } from './owner-errors';
import { DISCOVERY_COPY } from './site/discovery-copy';
import { type DiscoveryFile, OPEN_READ_HEADERS, discoveryResponse } from './site/discovery-response';
import { LANDING_COPY } from './site/landing-copy';
import { SITE_ICONS, SiteIcon } from './site/site-icons';
import { MCP_URL, SITE_URL } from './site/site-urls';

export const SERVER_CARD_MEDIA_TYPE = 'application/mcp-server-card+json';

const CARD_SCHEMA_URL = 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json';
const CARD_NAME = 'app.todz/todz';
const REMOTE_TYPE = 'streamable-http';
const AUTHORIZATION_HEADER = 'Authorization';
const ICON = SITE_ICONS[SiteIcon.Icon512];

const SERVER_CARD = JSON.stringify({
  $schema: CARD_SCHEMA_URL,
  name: CARD_NAME,
  version: MCP_SERVER_VERSION,
  description: DISCOVERY_COPY.card.description,
  title: LANDING_COPY.meta.siteName,
  websiteUrl: SITE_URL,
  icons: [{ src: `${SITE_URL}${ICON.path}`, mimeType: ICON.mediaType, sizes: [`${ICON.size}x${ICON.size}`] }],
  remotes: [
    {
      type: REMOTE_TYPE,
      url: MCP_URL,
      headers: [{ name: AUTHORIZATION_HEADER, isRequired: true, isSecret: true }],
      supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
    },
  ],
});

export const SERVER_CARD_FILE: Omit<DiscoveryFile, 'path'> = {
  contentType: SERVER_CARD_MEDIA_TYPE,
  body: SERVER_CARD,
  headers: OPEN_READ_HEADERS,
};

export function serveServerCard({ request }: { request: Request }): Response {
  const isReadMethod = request.method === HttpMethod.Get || request.method === HttpMethod.Head;
  if (!isReadMethod) return noRouteResponse();
  return discoveryResponse(SERVER_CARD_FILE);
}
