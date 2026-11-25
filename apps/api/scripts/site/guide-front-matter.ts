const FENCE = '---\n';
const CLOSING_FENCE = '\n---\n';
const TITLE_PREFIX = 'title: ';
const LINE_SEPARATOR = '\n';

export function guideMarkdown(source: string): string {
  const closingIndex = source.indexOf(CLOSING_FENCE);
  if (!source.startsWith(FENCE) || closingIndex < 0) throw new Error('the guide has no front matter');
  const title = source
    .slice(FENCE.length, closingIndex)
    .split(LINE_SEPARATOR)
    .find((line) => line.startsWith(TITLE_PREFIX));
  if (title === undefined) throw new Error("the guide's front matter has no title");
  const body = source.slice(closingIndex + CLOSING_FENCE.length);
  return `# ${title.slice(TITLE_PREFIX.length)}\n${body}`;
}
