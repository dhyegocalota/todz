import { digestCredential } from './credential-digest';
import { CodeTable, CodeVerdict, EMAIL_CODE_PATTERN, type CodeOutcome, spendEmailCode } from './email-code';
import { normalizedAddress } from './email-address';
import type { Env } from './env';
import { OwnerErrorCode, errorResponse } from './owner-errors';
import { codeLimitRefusal, codeLockedResponse } from './sign-in-limiter';
import { SIGN_IN_PROVIDER_OF_KIND, SignInProviderKind } from './sign-in-provider';

export enum SignInCredentialKind {
  Token = 'token',
  Code = 'code',
}

export type SignInCredentialBody = {
  identity_token?: string | undefined;
  email?: string | undefined;
  email_code?: string | undefined;
  link_verifier?: string | undefined;
};

type TokenCredential = { kind: SignInCredentialKind.Token; token: string; linkVerifier: string | undefined };

type CodeCredential = { kind: SignInCredentialKind.Code; address: string; code: string; linkVerifier: string };

export type SignInCredential = TokenCredential | CodeCredential;

type SubjectContext = { request: Request; env: Env; now: number; providerKind: SignInProviderKind };

function codeCredentialOf({ body, providerKind }: { body: SignInCredentialBody; providerKind: SignInProviderKind }): CodeCredential | null {
  const { identity_token: token, email, email_code: code, link_verifier: linkVerifier } = body;
  if (code === undefined || email === undefined || linkVerifier === undefined) return null;
  const address = normalizedAddress(email);
  const isUnusableCode = token !== undefined || providerKind !== SignInProviderKind.Email || !EMAIL_CODE_PATTERN.test(code);
  if (address === null || isUnusableCode) return null;
  return { kind: SignInCredentialKind.Code, address, code, linkVerifier };
}

export function credentialOf({
  body,
  providerKind,
}: {
  body: SignInCredentialBody;
  providerKind: SignInProviderKind;
}): SignInCredential | null {
  if (body.email_code !== undefined) return codeCredentialOf({ body, providerKind });
  if (body.identity_token === undefined) return null;
  return { kind: SignInCredentialKind.Token, token: body.identity_token, linkVerifier: body.link_verifier };
}

async function tokenSubjectOf({
  credential,
  context,
}: {
  credential: TokenCredential;
  context: SubjectContext;
}): Promise<string | Response> {
  const subject = await SIGN_IN_PROVIDER_OF_KIND[context.providerKind].verify({
    identityToken: credential.token,
    linkVerifier: credential.linkVerifier,
    directory: context.env.DIRECTORY,
    now: context.now,
  });
  if (subject === null) return errorResponse(OwnerErrorCode.IdentityRejected);
  return subject;
}

function answerOfCodeOutcome(outcome: CodeOutcome): string | Response {
  if (outcome.verdict === CodeVerdict.Spent) return outcome.email;
  if (outcome.verdict === CodeVerdict.Locked) return codeLockedResponse(outcome.retryAfterMs);
  return errorResponse(OwnerErrorCode.IdentityRejected);
}

async function codeSubjectOf({ credential, context }: { credential: CodeCredential; context: SubjectContext }): Promise<string | Response> {
  const limitRefusal = await codeLimitRefusal({ request: context.request, env: context.env });
  if (limitRefusal !== null) return limitRefusal;
  const outcome = await spendEmailCode({
    directory: context.env.DIRECTORY,
    table: CodeTable.SignInLinks,
    email: credential.address,
    challenge: await digestCredential(credential.linkVerifier),
    code: credential.code,
    now: context.now,
  });
  return answerOfCodeOutcome(outcome);
}

export async function subjectOf({
  credential,
  context,
}: {
  credential: SignInCredential;
  context: SubjectContext;
}): Promise<string | Response> {
  if (credential.kind === SignInCredentialKind.Code) return codeSubjectOf({ credential, context });
  return tokenSubjectOf({ credential, context });
}
