import { HttpHeader, NO_REFERRER, NO_SNIFF, STRICT_TRANSPORT_SECURITY } from '../http-header';
import { HttpStatus } from '../http-status';
import { sourceHash } from '../turnstile-page';
import { ADMIN_PAGE_RESPONSE_HEADERS } from './admin-paths';
import { SWITCH_SCRIPT } from './site-switch-script';

const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
// NB ADR 0060: no-transform stops Cloudflare injecting its analytics beacon, which the policy would refuse.
const CACHE_CONTROL = 'no-cache, no-transform';
const CONNECT_SELF = "connect-src 'self'";
const MANIFEST_SELF = "manifest-src 'self'";
const FORM_ACTION_SELF = "form-action 'self'";

export async function siteContentSecurityPolicy({
  style,
  scripts,
  widgetOrigin,
  connectsToSelf,
  declaresManifest,
}: {
  style: string;
  scripts: string[];
  widgetOrigin: string | null;
  connectsToSelf: boolean;
  declaresManifest: boolean;
}): Promise<string> {
  const widgetOrigins = widgetOrigin === null ? [] : [widgetOrigin];
  const connectDirectives = connectsToSelf ? [CONNECT_SELF] : [];
  const manifestDirectives = declaresManifest ? [MANIFEST_SELF] : [];
  const scriptHashes = await Promise.all([...scripts, SWITCH_SCRIPT].map(sourceHash));
  const scriptDirectives = [['script-src', ...scriptHashes, ...widgetOrigins].join(' ')];
  return [
    "default-src 'none'",
    ...scriptDirectives,
    `style-src ${await sourceHash(style)}`,
    "img-src 'self'",
    ...manifestDirectives,
    ...connectDirectives,
    ...widgetOrigins.map((origin) => `frame-src ${origin}`),
    FORM_ACTION_SELF,
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join('; ');
}

// NB ADR 0109: a form whose answer redirects to another origin needs that origin in form-action, or the browser blocks the redirect.
export function withFormOrigin({ policy, origin }: { policy: string; origin: string }): string {
  return policy.replace(FORM_ACTION_SELF, () => `${FORM_ACTION_SELF} ${origin}`);
}

export function sitePageResponse({ html, contentSecurityPolicy }: { html: string; contentSecurityPolicy: string }): Response {
  return new Response(html, {
    status: HttpStatus.Ok,
    headers: {
      [HttpHeader.ContentType]: HTML_CONTENT_TYPE,
      [HttpHeader.CacheControl]: CACHE_CONTROL,
      [HttpHeader.ReferrerPolicy]: NO_REFERRER,
      [HttpHeader.ContentTypeOptions]: NO_SNIFF,
      [HttpHeader.StrictTransportSecurity]: STRICT_TRANSPORT_SECURITY,
      [HttpHeader.ContentSecurityPolicy]: contentSecurityPolicy,
    },
  });
}

export function adminPageResponse({ html, contentSecurityPolicy }: { html: string; contentSecurityPolicy: string }): Response {
  const response = sitePageResponse({ html, contentSecurityPolicy });
  Object.entries(ADMIN_PAGE_RESPONSE_HEADERS).forEach(([name, value]) => response.headers.set(name, value));
  return response;
}
