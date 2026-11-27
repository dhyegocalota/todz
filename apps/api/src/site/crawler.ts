import { HttpHeader } from '../http-header';

const CRAWLER_TOKENS = [
  'bot',
  'crawl',
  'spider',
  'slurp',
  'facebookexternalhit',
  'oai-searchbot',
  'chatgpt-user',
  'claude-user',
  'perplexity-user',
  'ccbot',
];

export function isCrawlerRequest({ request }: { request: Request }): boolean {
  const userAgent = request.headers.get(HttpHeader.UserAgent);
  if (userAgent === null) return false;
  const normalizedUserAgent = userAgent.toLowerCase();
  return CRAWLER_TOKENS.some((token) => normalizedUserAgent.includes(token));
}
