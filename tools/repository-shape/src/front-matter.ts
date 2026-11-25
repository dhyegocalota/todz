const FENCE = '---\n';
const CLOSING_FENCE = '\n---\n';
const KEY_PATTERN = /^([\w-]+): (.*)$/;
const LINE_SEPARATOR = '\n';
const BLANK_LINE_LENGTH = 1;

function frontMatterBounds(text: string): { header: string; bodyStart: number } {
  const closingIndex = text.indexOf(CLOSING_FENCE);
  if (!text.startsWith(FENCE) || closingIndex < 0) throw new Error('the page has no front matter');
  const afterFence = closingIndex + CLOSING_FENCE.length;
  const blankLine = text.startsWith(LINE_SEPARATOR, afterFence) ? BLANK_LINE_LENGTH : 0;
  return { header: text.slice(FENCE.length, closingIndex), bodyStart: afterFence + blankLine };
}

export function frontMatterOf(text: string): Record<string, string> {
  const entries = frontMatterBounds(text)
    .header.split(LINE_SEPARATOR)
    .flatMap((line) => {
      const match = KEY_PATTERN.exec(line);
      if (!match) return [];
      return [[match[1], match[2]] as const];
    });
  return Object.fromEntries(entries);
}

export function bodyOf(text: string): string {
  return text.slice(frontMatterBounds(text).bodyStart);
}
