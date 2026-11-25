const HTML_ESCAPES: [string, string][] = [
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
];

export function escapedHtml(text: string): string {
  return HTML_ESCAPES.reduce((escaped, [character, entity]) => escaped.replaceAll(character, entity), text);
}
