import { ABSENT_INDEX, REPLY_ATTRIBUTION_ADDRESS, TASK_TITLE_MAX_LENGTH } from '@todz/types';

const PARAGRAPH_BREAK = /\r?\n(?:[ \t]*\r?\n)+/;
const LINE_BREAK = /\r?\n/;
const WHITESPACE_RUN = /\s+/g;
const CONTROL_CHARACTER = /[^\P{Cc}\t]|[\p{Zl}\p{Zp}]/u;
const QUOTE_LINE_PREFIX = '>';
const SIGNATURE_DELIMITER = '-- ';
const ORIGINAL_MESSAGE_RULE = /^-{3,}\s*Original Message\s*-{3,}$/i;
const UNDERSCORE_RULE = /^_{5,}$/;

export enum TitleOutcome {
  Titled = 'titled',
  Empty = 'empty',
  InvalidTitle = 'invalid_title',
}

export type ReplyTitle = { outcome: TitleOutcome.Titled; title: string } | { outcome: Exclude<TitleOutcome, TitleOutcome.Titled> };

function isQuoteMarker(line: string): boolean {
  const isQuoted = line.startsWith(QUOTE_LINE_PREFIX);
  const isSignature = line === SIGNATURE_DELIMITER;
  const isOutlookRule = ORIGINAL_MESSAGE_RULE.test(line.trim()) || UNDERSCORE_RULE.test(line.trim());
  return isQuoted || isSignature || isOutlookRule;
}

function isAttribution(lines: string[]): boolean {
  return lines.join(' ').toLowerCase().includes(REPLY_ATTRIBUTION_ADDRESS);
}

function isQuoteStart(lines: string[]): boolean {
  return isAttribution(lines) || lines.some(isQuoteMarker);
}

function linesBeforeQuote(lines: string[]): string[] {
  if (isAttribution(lines)) return [];
  const markerIndex = lines.findIndex(isQuoteMarker);
  if (markerIndex === ABSENT_INDEX) return lines;
  return lines.slice(0, markerIndex);
}

function linesAboveQuote(text: string): string[] {
  const paragraphs = text.split(PARAGRAPH_BREAK).map((paragraph) => paragraph.split(LINE_BREAK));
  const quoteIndex = paragraphs.findIndex(isQuoteStart);
  if (quoteIndex === ABSENT_INDEX) return paragraphs.flat();
  const quoteParagraphs = paragraphs.slice(quoteIndex, quoteIndex + 1);
  return [...paragraphs.slice(0, quoteIndex).flat(), ...quoteParagraphs.flatMap(linesBeforeQuote)];
}

export function replyTitleOf(text: string | undefined): ReplyTitle {
  if (text === undefined) return { outcome: TitleOutcome.Empty };
  const firstLine = linesAboveQuote(text).find((line) => line.trim() !== '');
  if (firstLine === undefined) return { outcome: TitleOutcome.Empty };
  if (CONTROL_CHARACTER.test(firstLine)) return { outcome: TitleOutcome.InvalidTitle };
  const collapsed = firstLine.replace(WHITESPACE_RUN, ' ').trim();
  const title = Array.from(collapsed).slice(0, TASK_TITLE_MAX_LENGTH).join('').trim();
  return { outcome: TitleOutcome.Titled, title };
}
