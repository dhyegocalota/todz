import { ABSENT_INDEX, MAIL_SENDER_ADDRESS, TASK_TITLE_MAX_LENGTH } from '@todz/types';

const PARAGRAPH_BREAK = /\r?\n(?:[ \t]*\r?\n)+/;
const LINE_BREAK = /\r?\n/;
const WHITESPACE_RUN = /\s+/g;
const CONTROL_CHARACTER = /[^\P{Cc}\t]|[\p{Zl}\p{Zp}]/u;
const QUOTE_LINE_PREFIX = '>';
const SIGNATURE_DELIMITER = '-- ';
const ORIGINAL_MESSAGE_RULE = /^-{3,}\s*Original Message\s*-{3,}$/i;
const UNDERSCORE_RULE = /^_{5,}$/;
const ATTRIBUTION_WRAP_LINE = /\d|,$/;
const ATTRIBUTION_END = ':';

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

function namesSender(line: string): boolean {
  return line.toLowerCase().includes(MAIL_SENDER_ADDRESS);
}

function isAttribution(lines: string[]): boolean {
  return namesSender(lines.join(' '));
}

function isQuoteStart(lines: string[]): boolean {
  return isAttribution(lines) || lines.some(isQuoteMarker);
}

function isAttributionEnd(line: string | undefined): boolean {
  return line !== undefined && line.trim().endsWith(ATTRIBUTION_END);
}

function attributionStartOf(lines: string[]): number {
  const addressIndex = lines.findIndex(namesSender);
  if (addressIndex === ABSENT_INDEX) return 0;
  const lastReplyLineIndex = lines.slice(0, addressIndex).findLastIndex((line) => !ATTRIBUTION_WRAP_LINE.test(line.trim()));
  return lastReplyLineIndex + 1;
}

function linesBeforeQuote(lines: string[]): string[] {
  if (isAttribution(lines)) return lines.slice(0, attributionStartOf(lines));
  const markerIndex = lines.findIndex(isQuoteMarker);
  if (markerIndex === ABSENT_INDEX) return lines;
  const isAfterAttribution = lines[markerIndex]?.startsWith(QUOTE_LINE_PREFIX) === true && isAttributionEnd(lines[markerIndex - 1]);
  if (isAfterAttribution) return lines.slice(0, markerIndex - 1);
  return lines.slice(0, markerIndex);
}

function quoteParagraphIndexOf(paragraphs: string[][]): number {
  const quoteIndex = paragraphs.findIndex(isQuoteStart);
  const startsAtQuotedLine = paragraphs[quoteIndex]?.[0]?.startsWith(QUOTE_LINE_PREFIX) === true;
  const followsAttribution = isAttributionEnd(paragraphs[quoteIndex - 1]?.at(-1));
  if (startsAtQuotedLine && followsAttribution) return quoteIndex - 1;
  return quoteIndex;
}

function linesAboveQuote(text: string): string[] {
  const paragraphs = text.split(PARAGRAPH_BREAK).map((paragraph) => paragraph.split(LINE_BREAK));
  const quoteIndex = quoteParagraphIndexOf(paragraphs);
  if (quoteIndex === ABSENT_INDEX) return paragraphs.flat();
  const quoteLines = paragraphs.slice(quoteIndex, quoteIndex + 1).flat();
  const linesOfQuoteParagraph = isQuoteStart(quoteLines) ? linesBeforeQuote(quoteLines) : [];
  return [...paragraphs.slice(0, quoteIndex).flat(), ...linesOfQuoteParagraph];
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
