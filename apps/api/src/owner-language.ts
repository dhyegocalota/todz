import { storeOwnerLanguage } from './directory-owners';
import type { Env } from './env';
import { HttpHeader } from './http-header';
import { supportedLanguageOfAcceptLanguage } from './language-negotiation';
import { type SessionOwner, storedLanguageOf } from './project-routing';

export async function refreshOwnerLanguage({ request, env, owner }: { request: Request; env: Env; owner: SessionOwner }): Promise<void> {
  const requestedLanguage = supportedLanguageOfAcceptLanguage({ acceptLanguage: request.headers.get(HttpHeader.AcceptLanguage) });
  if (requestedLanguage === null) return;
  if (requestedLanguage === storedLanguageOf({ owner })) return;
  await storeOwnerLanguage({ directory: env.DIRECTORY, ownerId: owner.ownerId, language: requestedLanguage });
}
