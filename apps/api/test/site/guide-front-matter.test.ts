import { describe, expect, test } from 'vitest';
import { guideMarkdown } from '../../scripts/site/guide-front-matter';

describe('guideMarkdown', () => {
  test('turns the title of the front matter into the first heading', () => {
    expect(guideMarkdown('---\ntitle: Self-host todz\n---\n\nRun your own todz server.\n')).toBe(
      '# Self-host todz\n\nRun your own todz server.\n',
    );
  });

  test('throws when the guide has no front matter', () => {
    expect(() => guideMarkdown('Run your own todz server.\n')).toThrow('the guide has no front matter');
  });

  test('throws when the front matter has no title', () => {
    expect(() => guideMarkdown('---\ndescription: Run it\n---\n\nRun your own todz server.\n')).toThrow(
      "the guide's front matter has no title",
    );
  });
});
