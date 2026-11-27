import { Language, REPOSITORY } from '@todz/types';
import type { Env } from '../env';
import { HttpHeader } from '../http-header';
import { HttpMethod, READ_METHODS } from '../http-method';
import { HttpStatus } from '../http-status';
import { pagePreferencesOf } from '../page-preferences';
import { noRouteResponse } from '../owner-errors';
import { ADMIN_ROUTES } from './admin-routes';
import { APPCAST_PATH, serveAppcast } from './appcast';
import { discoveryResponse } from './discovery-response';
import { LANDING_MARKDOWN_FILE, MARKDOWN_MEDIA_TYPE } from './landing-markdown';
import { serveLandingPage } from './landing-page';
import { NEGOTIATION_VARY, negotiatedRedirectOf, serveLanguage, serveTheme } from './language-routes';
import { publicPathOf, slashedPathOf } from './language-paths';
import { repositoryStarsOf } from './repository-stars';
import { SELF_HOST_PATH, redirectToDocs } from './self-host-redirect';
import { REPOSITORY_API_URL, REPOSITORY_STARS_CACHE_NAME } from './site-constants';
import { serveCloudQueueJoin, serveCloudQueuePage } from './cloud-queue-form';
import { DISCOVERY_FILES } from './site-discovery';
import { SitePath } from './site-paths';
import { CLOUD_QUEUE_PATH, LANDING_PATH } from './site-urls';

export type SiteContext = { request: Request; env: Env; executionContext: ExecutionContext };

export type SiteRoute = (context: SiteContext) => Promise<Response> | Response;

function routeKey({ method, pathname }: { method: string; pathname: string }): string {
  return `${method} ${pathname}`;
}

function repositoryApiUrlOf({ REPOSITORY_API_ORIGIN: apiOrigin }: Env): string {
  if (apiOrigin === undefined) return REPOSITORY_API_URL;
  return `${apiOrigin}/repos/${REPOSITORY.path}`;
}

function serveLandingMarkdown(): Response {
  return discoveryResponse({ ...LANDING_MARKDOWN_FILE, headers: { [HttpHeader.Vary]: HttpHeader.Accept } });
}

async function landingResponse({ request, env, language }: SiteContext & { language: Language }): Promise<Response> {
  const stars = await repositoryStarsOf({
    fetchImplementation: fetch,
    cache: await caches.open(REPOSITORY_STARS_CACHE_NAME),
    apiUrl: repositoryApiUrlOf(env),
  });
  return serveLandingPage({ stars, preferences: pagePreferencesOf({ request, language }) });
}

async function serveEnglishLanding(context: SiteContext): Promise<Response> {
  const wantsMarkdown = context.request.headers.get(HttpHeader.Accept)?.includes(MARKDOWN_MEDIA_TYPE) === true;
  if (wantsMarkdown) return serveLandingMarkdown();
  const redirect = negotiatedRedirectOf({ request: context.request });
  if (redirect !== null) return redirect;
  return landingResponse({ ...context, language: Language.English });
}

async function serveEnglishCloudQueuePage(context: SiteContext): Promise<Response> {
  const redirect = negotiatedRedirectOf({ request: context.request });
  if (redirect !== null) return redirect;
  const response = await serveCloudQueuePage({ ...context, language: Language.English });
  const varied = new Response(response.body, response);
  varied.headers.append(HttpHeader.Vary, NEGOTIATION_VARY);
  return varied;
}

function publicRoutesOf(language: Language): [string, SiteRoute][] {
  const isEnglish = language === Language.English;
  const landing: SiteRoute = isEnglish ? serveEnglishLanding : (context) => landingResponse({ ...context, language });
  const queue: SiteRoute = isEnglish ? serveEnglishCloudQueuePage : (context) => serveCloudQueuePage({ ...context, language });
  const landingPath = publicPathOf({ language, path: LANDING_PATH });
  const queuePath = publicPathOf({ language, path: CLOUD_QUEUE_PATH });
  return [
    ...READ_METHODS.map((method): [string, SiteRoute] => [routeKey({ method, pathname: landingPath }), landing]),
    ...READ_METHODS.map((method): [string, SiteRoute] => [routeKey({ method, pathname: queuePath }), queue]),
    [routeKey({ method: HttpMethod.Post, pathname: queuePath }), (context) => serveCloudQueueJoin({ ...context, language })],
  ];
}

const ADMIN_ROUTE_OF_REQUEST: Record<string, SiteRoute> = Object.fromEntries(
  ADMIN_ROUTES.map(({ method, path, route }) => [routeKey({ method, pathname: path }), route]),
);

const DISCOVERY_ROUTE_OF_REQUEST: Record<string, SiteRoute> = Object.fromEntries(
  DISCOVERY_FILES.flatMap(({ path, ...file }) =>
    [HttpMethod.Get, HttpMethod.Head].map((method): [string, SiteRoute] => [
      routeKey({ method, pathname: path }),
      () => discoveryResponse(file),
    ]),
  ),
);

const PUBLIC_ROUTE_OF_REQUEST: Record<string, SiteRoute> = Object.fromEntries(Object.values(Language).flatMap(publicRoutesOf));

const ROUTE_OF_REQUEST: Record<string, SiteRoute> = {
  ...ADMIN_ROUTE_OF_REQUEST,
  ...DISCOVERY_ROUTE_OF_REQUEST,
  ...PUBLIC_ROUTE_OF_REQUEST,
  [routeKey({ method: HttpMethod.Post, pathname: SitePath.Language })]: ({ request }) => serveLanguage({ request }),
  [routeKey({ method: HttpMethod.Post, pathname: SitePath.Theme })]: ({ request }) => serveTheme({ request }),
  [routeKey({ method: HttpMethod.Get, pathname: APPCAST_PATH })]: serveAppcast,
  [routeKey({ method: HttpMethod.Head, pathname: APPCAST_PATH })]: serveAppcast,
  [routeKey({ method: HttpMethod.Get, pathname: SELF_HOST_PATH })]: redirectToDocs,
  [routeKey({ method: HttpMethod.Head, pathname: SELF_HOST_PATH })]: redirectToDocs,
};

function slashRedirectOf({ method, url }: { method: string; url: URL }): Response | null {
  if (!READ_METHODS.includes(method)) return null;
  const slashedPath = slashedPathOf({ pathname: url.pathname });
  if (slashedPath === null) return null;
  return new Response(null, { status: HttpStatus.MovedPermanently, headers: { [HttpHeader.Location]: `${slashedPath}${url.search}` } });
}

export async function serveSite(context: SiteContext): Promise<Response> {
  const url = new URL(context.request.url);
  const slashRedirect = slashRedirectOf({ method: context.request.method, url });
  if (slashRedirect !== null) return slashRedirect;
  const route = ROUTE_OF_REQUEST[routeKey({ method: context.request.method, pathname: url.pathname })];
  if (route === undefined) return noRouteResponse();
  return route(context);
}
