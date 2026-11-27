export const SITE_URL = 'https://todz.app';
export const MCP_URL = 'https://api.todz.app/mcp';
export const DOCS_URL = 'https://docs.todz.app';
export const DOCS_INSTALL_URL = `${DOCS_URL}/install-on-mac`;
export const DOCS_MCP_URL = `${DOCS_URL}/mcp`;
export const DOCS_CONNECT_URL = `${DOCS_URL}/connect-an-agent`;
export const CLOUD_QUEUE_PATH = '/cloud-queue';
export const CLOUD_QUEUE_TOKEN_FIELD = 'token';
export const DOWNLOAD_PATH = '/download';
export const DOWNLOAD_URL = `${SITE_URL}${DOWNLOAD_PATH}`;
export const DOWNLOAD_LATEST_PATH = `${DOWNLOAD_PATH}/latest`;
export const SERVER_CARD_PATH = '/mcp/server-card';

export enum DiscoveryPath {
  Robots = '/robots.txt',
  Sitemap = '/sitemap.xml',
  Llms = '/llms.txt',
  LlmsFull = '/llms-full.txt',
  Manifest = '/site.webmanifest',
  Catalog = '/.well-known/ard.json',
  ServerCard = '/.well-known/mcp/server-card.json',
  ApiCatalog = '/.well-known/api-catalog',
  LandingMarkdown = '/index.md',
}
