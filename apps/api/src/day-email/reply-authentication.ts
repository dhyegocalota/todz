import type { Header } from 'postal-mime';
import { headersNamed } from './reply-headers';

const AUTHENTICATION_RESULTS_HEADER = 'authentication-results';
const AUTHENTICATION_SERVICE = 'mx.cloudflare.net';
const VERSION_PATTERN = /^\d+$/;
const WHITESPACE_PATTERN = /\s/;
const NO_RESULTS_TOKEN = 'none';
const QUOTE = '"';
const ESCAPE = '\\';
const COMMENT_OPEN = '(';
const COMMENT_CLOSE = ')';
const RESULT_SEPARATOR = ';';
const ASSIGNMENT = '=';
const DMARC_METHOD = 'dmarc';
const DKIM_METHOD = 'dkim';
const PASS_RESULT = 'pass';
const DMARC_DOMAIN_PROPERTY = 'header.from';
const DKIM_DOMAIN_PROPERTY = 'header.d';
const IDENTIFICATION_TOKEN_MAX = 2;

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
  DkimNotSingle = 'dkim_not_single',
  ResultsAfterDmarc = 'results_after_dmarc',
}

export type Authentication =
  { verdict: AuthenticationVerdict.Passed; domain: string } | { verdict: Exclude<AuthenticationVerdict, AuthenticationVerdict.Passed> };

type Scan = {
  segments: string[][];
  segment: string[];
  token: string;
  isInQuote: boolean;
  isEscaped: boolean;
  commentDepth: number;
};

type Property = { key: string; value: string };
type ResultInfo = { method: string; result: string; properties: Property[] };

function endToken(scan: Scan): void {
  if (scan.token !== '') scan.segment.push(scan.token);
  scan.token = '';
}

function endSegment(scan: Scan): void {
  endToken(scan);
  scan.segments.push(scan.segment);
  scan.segment = [];
}

function scannedCommentCharacter(scan: Scan, character: string): Scan {
  if (scan.isEscaped) {
    scan.isEscaped = false;
    return scan;
  }
  if (character === ESCAPE) {
    scan.isEscaped = true;
    return scan;
  }
  if (character === COMMENT_OPEN) {
    scan.commentDepth += 1;
    return scan;
  }
  if (character === COMMENT_CLOSE) scan.commentDepth -= 1;
  return scan;
}

function scannedQuotedCharacter(scan: Scan, character: string): Scan {
  scan.token += character;
  if (scan.isEscaped) {
    scan.isEscaped = false;
    return scan;
  }
  if (character === ESCAPE) {
    scan.isEscaped = true;
    return scan;
  }
  if (character === QUOTE) scan.isInQuote = false;
  return scan;
}

function scannedCharacter(scan: Scan, character: string): Scan {
  if (scan.commentDepth > 0) return scannedCommentCharacter(scan, character);
  if (scan.isInQuote) return scannedQuotedCharacter(scan, character);
  if (character === QUOTE) {
    scan.isInQuote = true;
    scan.token += character;
    return scan;
  }
  if (character === COMMENT_OPEN) {
    endToken(scan);
    scan.commentDepth = 1;
    return scan;
  }
  if (character === RESULT_SEPARATOR) {
    endSegment(scan);
    return scan;
  }
  if (WHITESPACE_PATTERN.test(character)) {
    endToken(scan);
    return scan;
  }
  scan.token += character;
  return scan;
}

function segmentsOf(value: string): string[][] | null {
  const initial: Scan = { segments: [], segment: [], token: '', isInQuote: false, isEscaped: false, commentDepth: 0 };
  const scan = Array.from(value).reduce(scannedCharacter, initial);
  endSegment(scan);
  const isBalanced = !scan.isInQuote && scan.commentDepth === 0;
  if (!isBalanced) return null;
  return scan.segments.filter((segment) => segment.length > 0);
}

function unquoted(value: string): string {
  const isQuoted = value.length >= 2 && value.startsWith(QUOTE) && value.endsWith(QUOTE);
  if (!isQuoted) return value;
  return value.slice(1, -1);
}

function propertyOf(token: string): Property | null {
  const assignmentIndex = token.indexOf(ASSIGNMENT);
  const isAssignment = assignmentIndex > 0 && assignmentIndex < token.length - 1;
  if (!isAssignment) return null;
  return { key: token.slice(0, assignmentIndex).toLowerCase(), value: unquoted(token.slice(assignmentIndex + 1)).toLowerCase() };
}

function isProperty(property: Property | null): property is Property {
  return property !== null;
}

function isResultInfo(resultInfo: ResultInfo | null): resultInfo is ResultInfo {
  return resultInfo !== null;
}

function isNoResultsSegment(segment: string[]): boolean {
  return segment.join(' ').toLowerCase() === NO_RESULTS_TOKEN;
}

function resultInfoOf(segment: string[]): ResultInfo | null {
  const [head, ...rest] = segment;
  if (head === undefined) return null;
  const result = propertyOf(head);
  const properties = rest.map(propertyOf).filter(isProperty);
  const isWellFormed = result !== null && properties.length === rest.length;
  if (!isWellFormed) return null;
  return { method: result.key, result: result.value, properties };
}

function serviceOf(segments: string[][]): string | null {
  const [identification] = segments;
  if (identification === undefined) return null;
  const [service, version] = identification;
  const hasValidVersion = version === undefined || VERSION_PATTERN.test(version);
  const isIdentification = service !== undefined && identification.length <= IDENTIFICATION_TOKEN_MAX && hasValidVersion;
  if (!isIdentification) return null;
  return service.toLowerCase();
}

function resultInfosOf(header: Header): ResultInfo[] | null {
  const segments = segmentsOf(header.value);
  if (segments === null) return null;
  const resultSegments = segments.slice(1).filter((segment) => !isNoResultsSegment(segment));
  const resultInfos = resultSegments.map(resultInfoOf).filter(isResultInfo);
  if (resultInfos.length !== resultSegments.length) return null;
  return resultInfos;
}

function serviceNameOf(header: Header): string | null {
  const segments = segmentsOf(header.value);
  if (segments === null) return null;
  return serviceOf(segments);
}

function isCloudflareHeader(header: Header): boolean {
  return serviceNameOf(header) === AUTHENTICATION_SERVICE;
}

function valuesOf({ resultInfo, key }: { resultInfo: ResultInfo; key: string }): string[] {
  return resultInfo.properties.filter((property) => property.key === key).map((property) => property.value);
}

export function authenticationOf(headers: Header[]): Authentication {
  const resultsHeaders = headersNamed({ headers, name: AUTHENTICATION_RESULTS_HEADER });
  const [cloudflareHeader, ...otherCloudflareHeaders] = resultsHeaders.filter(isCloudflareHeader);
  if (cloudflareHeader === undefined) return { verdict: AuthenticationVerdict.MissingServiceHeader };
  if (otherCloudflareHeaders.length > 0) return { verdict: AuthenticationVerdict.DuplicateServiceHeader };
  if (resultsHeaders[0] !== cloudflareHeader) return { verdict: AuthenticationVerdict.ServiceHeaderNotFirst };
  const resultInfos = resultInfosOf(cloudflareHeader);
  if (resultInfos === null) return { verdict: AuthenticationVerdict.MalformedServiceHeader };
  const [dmarcResult, ...otherDmarcResults] = resultInfos.filter((resultInfo) => resultInfo.method === DMARC_METHOD);
  if (dmarcResult === undefined || otherDmarcResults.length > 0) return { verdict: AuthenticationVerdict.DmarcNotSingle };
  if (dmarcResult.result !== PASS_RESULT) return { verdict: AuthenticationVerdict.DmarcNotPassed };
  const [domain, ...otherDomains] = valuesOf({ resultInfo: dmarcResult, key: DMARC_DOMAIN_PROPERTY });
  if (domain === undefined || otherDomains.length > 0) return { verdict: AuthenticationVerdict.DmarcDomainMissing };
  const hasResultsAfterDmarc = resultInfos.indexOf(dmarcResult) !== resultInfos.length - 1;
  if (hasResultsAfterDmarc) return { verdict: AuthenticationVerdict.ResultsAfterDmarc };
  const [domainDkimResult, ...otherDomainDkimResults] = resultInfos.filter(
    (resultInfo) => resultInfo.method === DKIM_METHOD && valuesOf({ resultInfo, key: DKIM_DOMAIN_PROPERTY }).includes(domain),
  );
  if (otherDomainDkimResults.length > 0) return { verdict: AuthenticationVerdict.DkimNotSingle };
  if (domainDkimResult === undefined || domainDkimResult.result !== PASS_RESULT) return { verdict: AuthenticationVerdict.DkimNotAligned };
  return { verdict: AuthenticationVerdict.Passed, domain };
}
