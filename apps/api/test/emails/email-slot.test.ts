import { describe, expect, test } from 'vitest';
import { EmailSlot, filledHtmlOf, filledTextOf } from '../../src/emails/email-slot';

describe('the email slots', () => {
  test('are written between double braces', () => {
    expect(Object.values(EmailSlot)).toEqual([
      '{{link}}',
      '{{code}}',
      '{{email}}',
      '{{origin}}',
      '{{more}}',
      '{{count}}',
      '{{tasks}}',
      '{{workspace}}',
      '{{time}}',
      '{{stopUrl}}',
    ]);
  });

  test('fill every occurrence of a slot in text as it is', () => {
    expect(filledTextOf({ text: '{{email}} and {{email}}', values: { [EmailSlot.Email]: 'a&b' } })).toBe('a&b and a&b');
  });

  test('fill every slot of the pattern in one pass', () => {
    const values = {
      [EmailSlot.Link]: 'https://todz.app/in',
      [EmailSlot.Email]: 'maria@example.com',
      [EmailSlot.Origin]: 'http://localhost:8787',
    };
    expect(filledTextOf({ text: '{{origin}} {{link}} {{email}}', values })).toBe(
      'http://localhost:8787 https://todz.app/in maria@example.com',
    );
  });

  test('never expand again a value that holds a slot', () => {
    const values = { [EmailSlot.Email]: '{{link}}@x.io', [EmailSlot.Link]: 'https://todz.app/in' };
    expect(filledTextOf({ text: '{{email}} {{link}}', values })).toBe('{{link}}@x.io https://todz.app/in');
    expect(filledHtmlOf({ html: '<p>{{link}} {{email}}</p>', values })).toBe('<p>https://todz.app/in {{link}}@x.io</p>');
  });

  test('escape the five characters it writes into html', () => {
    expect(filledHtmlOf({ html: '<p>{{email}}</p>', values: { [EmailSlot.Email]: `<a href="x">&'</a>` } })).toBe(
      '<p>&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;</p>',
    );
  });

  test('escape a link written into an href', () => {
    expect(filledHtmlOf({ html: '<a href="{{link}}">x</a>', values: { [EmailSlot.Link]: 'https://a.b/?x=1&y="2"' } })).toBe(
      '<a href="https://a.b/?x=1&amp;y=&quot;2&quot;">x</a>',
    );
  });

  test('throw when the text holds a slot it has no value for', () => {
    expect(() => filledTextOf({ text: '{{link}} {{email}}', values: { [EmailSlot.Email]: 'x' } })).toThrow('no value for {{link}}');
  });

  test('throw when the html holds a slot it has no value for', () => {
    expect(() => filledHtmlOf({ html: '<p>{{origin}}</p>', values: {} })).toThrow('no value for {{origin}}');
  });

  test('ignore a value no slot of the template uses', () => {
    expect(filledTextOf({ text: '{{email}}', values: { [EmailSlot.Email]: 'x', [EmailSlot.Link]: 'y' } })).toBe('x');
  });
});
