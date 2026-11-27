import { LANGUAGE_REPORTING_APP_VERSION, APP_VERSION_HEADER } from '@todz/types';
import { isAppVersionAccepted } from './app-version';
import { storeOwnerLanguage } from './directory-owners';
import type { Env } from './env';
import { HttpHeader } from './http-header';
import { supportedLanguageOfAcceptLanguage } from './language-negotiation';
import type { SessionOwner } from './project-routing';

export function isLanguageReportingApp({ request }: { request: Request }): boolean {
  return isAppVersionAccepted({ candidate: request.headers.get(APP_VERSION_HEADER), minimum: LANGUAGE_REPORTING_APP_VERSION });
}

export async function refreshOwnerLanguage({ request, env, owner }: { request: Request; env: Env; owner: SessionOwner }): Promise<void> {
  if (!isLanguageReportingApp({ request })) return;
  const requestedLanguage = supportedLanguageOfAcceptLanguage({ acceptLanguage: request.headers.get(HttpHeader.AcceptLanguage) });
  if (requestedLanguage === null) return;
  await storeOwnerLanguage({ directory: env.DIRECTORY, ownerId: owner.ownerId, language: requestedLanguage });
}
