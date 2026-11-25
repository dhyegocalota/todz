export const SITE_URL = 'https://todz.app';
export const MCP_URL = 'https://api.todz.app/mcp';
export const DOCS_URL = 'https://docs.todz.app';
export const DOCS_INSTALL_URL = `${DOCS_URL}/install-on-mac`;
export const SERVER_CARD_PATH = '/mcp/server-card';

export enum DiscoveryPath {
  Robots = '/robots.txt',
  Sitemap = '/sitemap.xml',
  Llms = '/llms.txt',
  LlmsFull = '/llms-full.txt',
  Manifest = '/site.webmanifest',
  Catalog = '/.well-known/ard.json',
  ServerCard = '/.well-known/mcp/server-card.json',
}
