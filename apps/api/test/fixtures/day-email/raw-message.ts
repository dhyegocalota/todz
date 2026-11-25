import PostalMime from 'postal-mime';
import type { Email, Header } from 'postal-mime';

const LINE_BREAK = '\r\n';
const DEFAULT_BODY = 'Buy milk';

export const CLOUDFLARE_SERVICE = 'mx.cloudflare.net';
export const OWNER_DOMAIN = 'gmail.com';

export const CLOUDFLARE_RESULTS = `Authentication-Results: ${CLOUDFLARE_SERVICE}; spf=pass smtp.mailfrom=owner@${OWNER_DOMAIN}; dkim=pass header.d=${OWNER_DOMAIN} header.s=20230601; dmarc=pass header.from=${OWNER_DOMAIN}`;

export function rawMessageOf({ headers, body = DEFAULT_BODY }: { headers: string[]; body?: string }): string {
  return [...headers, '', body].join(LINE_BREAK);
}

export async function parsedMessageOf({ headers, body }: { headers: string[]; body?: string }): Promise<Email> {
  return PostalMime.parse(rawMessageOf({ headers, body }));
}

export async function parsedHeadersOf(headers: string[]): Promise<Header[]> {
  const message = await parsedMessageOf({ headers });
  return message.headers;
}
