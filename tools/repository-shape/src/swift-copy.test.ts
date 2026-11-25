import { describe, expect, test } from 'vitest';
import { swiftCopyValue } from './swift-copy';

const COPY_SOURCE = 'enum KeyScreenCopy {\n    static let title = "Connect an Agent"\n}';

describe('swiftCopyValue', () => {
  test('reads the string a static let holds', () => {
    expect(swiftCopyValue({ text: COPY_SOURCE, name: 'title' })).toBe('Connect an Agent');
  });

  test('throws when the name is not a static let of the file', () => {
    expect(() => swiftCopyValue({ text: COPY_SOURCE, name: 'subtitle' })).toThrow('subtitle is not a static let of this file');
  });
});
