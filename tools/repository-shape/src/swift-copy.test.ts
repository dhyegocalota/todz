import { describe, expect, test } from 'vitest';
import { swiftCopyValue } from './swift-copy';

const COPY_SOURCE = [
  'enum KeyScreenCopy {',
  '    static var title: String { Localized.text("Connect an Agent") }',
  '    static var caption: AttributedString { Localized.attributed("Or add to mcp.json") }',
  '    static let downloadAddress = "https://todz.app"',
  '}',
].join('\n');

describe('swiftCopyValue', () => {
  test('reads the English text a localized static var resolves', () => {
    expect(swiftCopyValue({ text: COPY_SOURCE, name: 'title' })).toBe('Connect an Agent');
  });

  test('reads the English text of a localized attributed string', () => {
    expect(swiftCopyValue({ text: COPY_SOURCE, name: 'caption' })).toBe('Or add to mcp.json');
  });

  test('reads the string a plain static let holds', () => {
    expect(swiftCopyValue({ text: COPY_SOURCE, name: 'downloadAddress' })).toBe('https://todz.app');
  });

  test('throws when the name is not a static of the file', () => {
    expect(() => swiftCopyValue({ text: COPY_SOURCE, name: 'subtitle' })).toThrow('subtitle is not a static of this file');
  });
});
