import PostalMime from 'postal-mime';
import { describe, expect, test } from 'vitest';
import { TitleOutcome, replyTitleOf } from '../../src/day-email/reply-title';
import { rawMessageOf } from '../fixtures/day-email/raw-message';

const ATTRIBUTION = 'On Wed, Nov 25, 2026 at 7:00 AM todz <noreply@todz.app> wrote:';
const QUOTED = '> Your day: 2 due\n> T-1 Pay rent';
const TITLE_MAX_LENGTH = 200;

function titled(title: string) {
  return { outcome: TitleOutcome.Titled, title };
}

describe('replyTitleOf finds the title above the quote', () => {
  test.each([
    ['an English attribution', `Buy milk\n\n${ATTRIBUTION}\n${QUOTED}`],
    ['a pt-BR attribution', 'Buy milk\n\nEm qua., 25 de nov. de 2026 às 07:00, todz <noreply@todz.app> escreveu:\n> Your day'],
    ['an attribution wrapped over two lines', 'Buy milk\n\nOn Wed, Nov 25, 2026 at 7:00 AM todz\n<noreply@todz.app> wrote:\n> Your day'],
    ['an attribution wrapped over three lines', 'Buy milk\n\nOn Wed, Nov 25, 2026\nat 7:00 AM todz\n<noreply@todz.app> wrote:\n> Your day'],
    ['an attribution naming the address in upper case', 'Buy milk\n\nOn Wed todz <NoReply@Todz.App> wrote:\n> Your day'],
    ['a quote with no attribution', 'Buy milk\n> Your day'],
    ['a quote after a blank line', 'Buy milk\n\n> Your day'],
    ['a signature delimiter', 'Buy milk\n\n-- \nOwner'],
    ["Outlook's original message rule", 'Buy milk\n\n-----Original Message-----\nFrom: todz'],
    ["Outlook's underscore rule", 'Buy milk\n\n________________________________\nFrom: todz'],
    ['CRLF line ends', `Buy milk\r\n\r\n${ATTRIBUTION}\r\n${QUOTED}`],
    ['leading blank lines', `\n\n  \nBuy milk\n\n${ATTRIBUTION}`],
    ['extra whitespace', '   Buy   milk  \n\n> quoted'],
    ['tabs and non-breaking spaces', 'Buy\t milk\n'],
    ['a second line that is ignored', 'Buy milk\nand eggs\n\n> quoted'],
    ['a second paragraph that is ignored', 'Buy milk\n\nand eggs'],
  ])('%s', (_name, text) => {
    expect(replyTitleOf(text)).toEqual(titled('Buy milk'));
  });

  test('the title is the first line of the text that holds both a title and later paragraphs', () => {
    expect(replyTitleOf('Call Ana\n\nThanks!\n\n-- \nOwner')).toEqual(titled('Call Ana'));
  });
});

describe('replyTitleOf finds no title', () => {
  test.each([
    ['a reply that is only the quote', `${ATTRIBUTION}\n${QUOTED}`],
    ['a reply that is only a quoted block', QUOTED],
    ['a reply that is only a signature', '-- \nOwner'],
    ['blank text', ' \n\n \t\n'],
    ['empty text', ''],
    ['only the original message rule', '-----Original Message-----\nFrom: todz'],
  ])('%s', (_name, text) => {
    expect(replyTitleOf(text)).toEqual({ outcome: TitleOutcome.Empty });
  });

  test('a message without a text part has no title', () => {
    expect(replyTitleOf(undefined)).toEqual({ outcome: TitleOutcome.Empty });
  });
});

describe('replyTitleOf with an attribution in the same paragraph as the reply', () => {
  test.each([
    ['one line', `Buy milk\n${ATTRIBUTION}\n${QUOTED}`],
    ['two lines', 'Buy milk\nOn Wed, Nov 25, 2026 at 7:00 AM todz\n<noreply@todz.app> wrote:\n> Your day'],
    ['three lines', 'Buy milk\nOn Wed, Nov 25, 2026\nat 7:00 AM todz\n<noreply@todz.app> wrote:\n> Your day'],
    ['a pt-BR one', 'Buy milk\nEm qua., 25 de nov. de 2026 às 07:00, todz <noreply@todz.app> escreveu:\n> Your day'],
  ])('%s keeps the line above it as the title', (_name, text) => {
    expect(replyTitleOf(text)).toEqual(titled('Buy milk'));
  });
});

describe('replyTitleOf with an attribution that does not name the address', () => {
  test.each([
    ['directly above the quote', 'On Wed, Nov 25, 2026 at 7:00 AM, todz wrote:\n> Your day'],
    ['a paragraph above the quote', 'On Wed, Nov 25, 2026 at 7:00 AM, todz wrote:\n\n> Your day'],
    ['a pt-BR one', 'Em qua., 25 de nov. de 2026 às 07:00, todz escreveu:\n> Your day'],
  ])('%s is part of the quote and leaves no title', (_name, text) => {
    expect(replyTitleOf(text)).toEqual({ outcome: TitleOutcome.Empty });
  });

  test('a title above it stays the title', () => {
    expect(replyTitleOf('Buy milk\n\nOn Wed, Nov 25, 2026 at 7:00 AM, todz wrote:\n> Your day')).toEqual(titled('Buy milk'));
  });
});

describe('replyTitleOf refuses control characters', () => {
  test.each([
    ['U+0085', 'Buy\u0085milk'],
    ['U+0007', 'Buy\u0007milk'],
    ['U+2028', 'Buy milk'],
    ['U+2029', 'Buy milk'],
    ['U+007F', 'Buy\u007fmilk'],
  ])('%s', (_name, text) => {
    expect(replyTitleOf(text)).toEqual({ outcome: TitleOutcome.InvalidTitle });
  });
});

describe('replyTitleOf cuts the title', () => {
  test('a 300 character line is cut to the maximum', () => {
    expect(replyTitleOf('a'.repeat(300))).toEqual(titled('a'.repeat(TITLE_MAX_LENGTH)));
  });

  test('an emoji at the cut is kept whole or left out, never split', () => {
    const text = `${'a'.repeat(TITLE_MAX_LENGTH - 1)}😀bc`;
    expect(replyTitleOf(text)).toEqual(titled(`${'a'.repeat(TITLE_MAX_LENGTH - 1)}😀`));
  });

  test('a cut that ends in a space is trimmed', () => {
    const text = `${'a'.repeat(TITLE_MAX_LENGTH - 1)} bc`;
    expect(replyTitleOf(text)).toEqual(titled('a'.repeat(TITLE_MAX_LENGTH - 1)));
  });
});

describe('replyTitleOf over a parsed format=flowed message', () => {
  async function textOf({ contentType, body }: { contentType: string; body: string }): Promise<string | undefined> {
    const raw = rawMessageOf({ headers: ['From: owner@gmail.com', `Content-Type: ${contentType}`], body });
    const message = await PostalMime.parse(raw);
    return message.text;
  }

  test('a soft-wrapped title line is joined', async () => {
    const text = await textOf({ contentType: 'text/plain; format=flowed', body: 'Buy milk and \r\neggs\r\n\r\n> quoted' });
    expect(replyTitleOf(text)).toEqual(titled('Buy milk and eggs'));
  });

  test('with delsp=yes the space of the wrap is removed', async () => {
    const text = await textOf({ contentType: 'text/plain; format=flowed; delsp=yes', body: 'Buy milk and \r\neggs\r\n\r\n> quoted' });
    expect(replyTitleOf(text)).toEqual(titled('Buy milk andeggs'));
  });

  test('a fixed text keeps its lines apart', async () => {
    const text = await textOf({ contentType: 'text/plain', body: 'Buy milk and \r\neggs' });
    expect(replyTitleOf(text)).toEqual(titled('Buy milk and'));
  });

  test('a flowed attribution is found where it wraps', async () => {
    const text = await textOf({
      contentType: 'text/plain; format=flowed',
      body: `Buy milk\r\n\r\nOn Wed, Nov 25, 2026 at 7:00 AM todz \r\n<noreply@todz.app> wrote:\r\n> Your day`,
    });
    expect(replyTitleOf(text)).toEqual(titled('Buy milk'));
  });
});
