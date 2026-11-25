import { describe, expect, test } from 'vitest';
import { bodyOf, frontMatterOf } from './front-matter';

const PAGE = '---\ntitle: Quickstart\n---\n\nBody\n';
const PAGE_WITHOUT_FRONT_MATTER = 'Body\n';

describe('frontMatterOf', () => {
  test('reads the keys of the front matter', () => {
    expect(frontMatterOf(PAGE)).toEqual({ title: 'Quickstart' });
  });

  test('throws when the page has no front matter', () => {
    expect(() => frontMatterOf(PAGE_WITHOUT_FRONT_MATTER)).toThrow('the page has no front matter');
  });
});

describe('bodyOf', () => {
  test('returns the text after the front matter', () => {
    expect(bodyOf(PAGE)).toBe('Body\n');
  });

  test('throws when the page has no front matter', () => {
    expect(() => bodyOf(PAGE_WITHOUT_FRONT_MATTER)).toThrow('the page has no front matter');
  });
});
