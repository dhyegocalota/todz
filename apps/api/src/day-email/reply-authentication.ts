import type { Header } from 'postal-mime';

export enum AuthenticationVerdict {
  Passed = 'passed',
  MissingServiceHeader = 'missing_service_header',
  DuplicateServiceHeader = 'duplicate_service_header',
  ServiceHeaderNotFirst = 'service_header_not_first',
  MalformedServiceHeader = 'malformed_service_header',
  DmarcNotSingle = 'dmarc_not_single',
  DmarcNotPassed = 'dmarc_not_passed',
  DmarcDomainMissing = 'dmarc_domain_missing',
  DkimNotAligned = 'dkim_not_aligned',
}

export type Authentication =
  { verdict: AuthenticationVerdict.Passed; domain: string } | { verdict: Exclude<AuthenticationVerdict, AuthenticationVerdict.Passed> };

export function authenticationOf(headers: Header[]): Authentication {
  throw new Error('authenticationOf is not implemented');
}
