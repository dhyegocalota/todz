import type { Header } from 'postal-mime';

const AUTO_SUBMITTED_HEADER = 'auto-submitted';
const AUTO_SUBMITTED_MANUAL = 'no';
const AUTOMATIC_MARKER_HEADERS = ['x-autoreply', 'x-autorespond'];
const PRECEDENCE_HEADER = 'precedence';
const AUTOMATIC_PRECEDENCES = ['bulk', 'junk', 'list', 'auto_reply'];
const PARAMETERS_PATTERN = /;[\s\S]*$/;

function keyOf(header: Header): string {
  return header.key.trim().toLowerCase();
}

function tokenOf(header: Header): string {
  return header.value.replace(PARAMETERS_PATTERN, '').trim().toLowerCase();
}

function isAutomaticHeader(header: Header): boolean {
  const key = keyOf(header);
  const isAutoSubmitted = key === AUTO_SUBMITTED_HEADER && tokenOf(header) !== AUTO_SUBMITTED_MANUAL;
  const isMarked = AUTOMATIC_MARKER_HEADERS.includes(key);
  const isAutomaticPrecedence = key === PRECEDENCE_HEADER && AUTOMATIC_PRECEDENCES.includes(tokenOf(header));
  return isAutoSubmitted || isMarked || isAutomaticPrecedence;
}

export function isAutomaticReply(headers: Header[]): boolean {
  return headers.some(isAutomaticHeader);
}
