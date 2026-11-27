import { digestCredential, isSameSignature, keyedDigest } from '../credential-digest';
import { generateCredentialSecret } from '../credential-secret';
import { findOwnedProject } from '../directory';
import { listOwnerWorkspaces } from '../directory-workspaces';
import { MediaType, hasMediaType, isBoundedRequest } from '../request-body';
import { isSameOriginRequest } from '../same-origin';
import {
  type AuthorizationOutcome,
  AuthorizationOutcomeKind,
  type AuthorizationRequest,
  authorizationOutcomeOf,
  redirectAnswerOf,
  refusalRedirectOf,
  requestTextOf,
} from './oauth-authorization-request';
import { type OAuthBrowserSession, oauthSessionOf } from './oauth-browser-session';
import type { OAuthContext } from './oauth-context';
import { OAuthError } from './oauth-errors';
import { OAuthNotice, OAuthRefusal, consentPageOf, refusalPageOf, signInPageOf } from './oauth-pages';
import { OAUTH_CODE_LIFETIME_MS, OAuthDecision, OAuthField, OAuthParameter } from './oauth-paths';
import { OAuthScope } from './oauth-scope';
import { linkGuardOf } from './oauth-sign-in';
import { insertCode } from './oauth-store';

const DECISION_FIELDS: string[] = [OAuthField.FormToken, OAuthField.Decision, OAuthField.Choice];

type DecisionForm = { params: URLSearchParams; formToken: string | null; decision: string | null; choice: string | null };

type Decided = { context: OAuthContext; request: AuthorizationRequest; session: OAuthBrowserSession; choice: string | null };

type ChosenScope = { projectId: string | null };

type ValidRequestAnswer = (context: OAuthContext, request: AuthorizationRequest) => Promise<Response>;

function formTokenOf({ session, request }: { session: OAuthBrowserSession; request: AuthorizationRequest }): Promise<string> {
  return keyedDigest({ secret: session.secret, text: requestTextOf(request) });
}

async function answerOfOutcome({
  context,
  outcome,
  answerValid,
}: {
  context: OAuthContext;
  outcome: AuthorizationOutcome;
  answerValid: ValidRequestAnswer;
}): Promise<Response> {
  if (outcome.kind === AuthorizationOutcomeKind.Unredirectable) return refusalPageOf(OAuthRefusal.Invalid);
  if (outcome.kind === AuthorizationOutcomeKind.Refused) {
    return refusalRedirectOf({ redirectUri: outcome.redirectUri, state: outcome.state, error: outcome.error, issuer: context.issuer });
  }
  return answerValid(context, outcome.request);
}

async function consentOrSignIn(context: OAuthContext, request: AuthorizationRequest): Promise<Response> {
  const guard = linkGuardOf(context);
  if (guard === null) return refusalPageOf(OAuthRefusal.Unavailable);
  const session = await oauthSessionOf(context);
  if (session === null)
    return signInPageOf({ clientName: request.client.name, params: request.params, notice: OAuthNotice.None, siteKey: guard.siteKey });
  const listings = await listOwnerWorkspaces({ directory: context.env.DIRECTORY, ownerId: session.ownerId });
  return consentPageOf({ request, listings, formToken: await formTokenOf({ session, request }) });
}

// NB ADR 0109: authorize answers the email form without a browser session and the consent screen with one.
export async function serveAuthorize(context: OAuthContext): Promise<Response> {
  const { request, env, now, issuer } = context;
  const outcome = await authorizationOutcomeOf({ params: new URL(request.url).searchParams, env, issuer, now });
  return answerOfOutcome({ context, outcome, answerValid: consentOrSignIn });
}

async function decisionFormOf(request: Request): Promise<DecisionForm | null> {
  const isReadableForm = isBoundedRequest({ request }) && hasMediaType({ request, mediaType: MediaType.Form });
  if (!isReadableForm) return null;
  const form = new URLSearchParams(await request.text());
  const params = new URLSearchParams([...form.entries()].filter(([name]) => !DECISION_FIELDS.includes(name)));
  return {
    params,
    formToken: form.get(OAuthField.FormToken),
    decision: form.get(OAuthField.Decision),
    choice: form.get(OAuthField.Choice),
  };
}

async function chosenScopeOf({ request, session, choice, context }: Decided): Promise<ChosenScope | null> {
  const isOwnerChoice = choice === OAuthScope.Owner && request.offeredScopes[OAuthScope.Owner];
  if (isOwnerChoice) return { projectId: null };
  const isProjectChoice = choice !== null && choice !== OAuthScope.Owner && request.offeredScopes[OAuthScope.Project];
  if (!isProjectChoice) return null;
  const projectId = await findOwnedProject({ directory: context.env.DIRECTORY, ownerId: session.ownerId, projectId: choice });
  if (projectId === null) return null;
  return { projectId };
}

async function approve(decided: Decided): Promise<Response> {
  const { context, request, session } = decided;
  const chosenScope = await chosenScopeOf(decided);
  if (chosenScope === null) return refusalPageOf(OAuthRefusal.Choice);
  const { projectId } = chosenScope;
  const code = generateCredentialSecret();
  await insertCode({
    directory: context.env.DIRECTORY,
    digest: await digestCredential(code),
    code: {
      clientId: request.client.id,
      ownerId: session.ownerId,
      projectId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      expiresAt: context.now + OAUTH_CODE_LIFETIME_MS,
    },
  });
  return redirectAnswerOf({
    redirectUri: request.redirectUri,
    issuer: context.issuer,
    values: [
      [OAuthParameter.Code, code],
      [OAuthParameter.State, request.state],
    ],
  });
}

async function deny({ context, request }: Decided): Promise<Response> {
  return refusalRedirectOf({
    redirectUri: request.redirectUri,
    state: request.state,
    error: OAuthError.AccessDenied,
    issuer: context.issuer,
  });
}

const ANSWER_OF_DECISION: Record<OAuthDecision, (decided: Decided) => Promise<Response>> = {
  [OAuthDecision.Approve]: approve,
  [OAuthDecision.Deny]: deny,
};

function isDecision(candidate: string | null): candidate is OAuthDecision {
  return candidate !== null && candidate in ANSWER_OF_DECISION;
}

function decide(form: DecisionForm): ValidRequestAnswer {
  return async (context, request) => {
    const guard = linkGuardOf(context);
    if (guard === null) return refusalPageOf(OAuthRefusal.Unavailable);
    if (!isSameOriginRequest({ request: context.request, origin: context.issuer })) return refusalPageOf(OAuthRefusal.Forbidden);
    const session = await oauthSessionOf(context);
    if (session === null)
      return signInPageOf({ clientName: request.client.name, params: request.params, notice: OAuthNotice.None, siteKey: guard.siteKey });
    if (form.formToken === null) return refusalPageOf(OAuthRefusal.Forbidden);
    const expected = await formTokenOf({ session, request });
    const isFormTokenValid = await isSameSignature({ secret: session.secret, left: expected, right: form.formToken });
    if (!isFormTokenValid) return refusalPageOf(OAuthRefusal.Forbidden);
    if (!isDecision(form.decision)) return refusalPageOf(OAuthRefusal.Invalid);
    return ANSWER_OF_DECISION[form.decision]({ context, request, session, choice: form.choice });
  };
}

// NB ADR 0109: a decision needs the same origin, the browser session and a form token bound to that session and this very request.
export async function serveDecision(context: OAuthContext): Promise<Response> {
  const { request, env, now, issuer } = context;
  const form = await decisionFormOf(request);
  if (form === null) return refusalPageOf(OAuthRefusal.Invalid);
  const outcome = await authorizationOutcomeOf({ params: form.params, env, issuer, now });
  return answerOfOutcome({ context, outcome, answerValid: decide(form) });
}
