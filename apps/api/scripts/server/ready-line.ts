const STRING_OR_LINE_COMMENT_PATTERN = /"(?:[^"\\]|\\.)*"|\/\/.*$/gm;
const STRING_QUOTE = '"';
const TRAILING_COMMA_PATTERN = /,(\s*[}\]])/g;
const MISSING_MESSAGE = 'PUBLIC_ORIGIN is missing from the Wrangler configuration';

type WranglerText = { vars?: { PUBLIC_ORIGIN?: string } };

function withoutLineComments(text: string): string {
  return text.replace(STRING_OR_LINE_COMMENT_PATTERN, (match) => (match.startsWith(STRING_QUOTE) ? match : ''));
}

export function readyLine({ publicOrigin }: { publicOrigin: string; serverVersion: string; minimumAppVersion: string }): string {
  return `todz server ready: ${publicOrigin}  →  paste it in todz › Settings › Server`;
}

export function publicOriginInWranglerText(wranglerText: string): string {
  const jsonText = withoutLineComments(wranglerText).replace(TRAILING_COMMA_PATTERN, '$1');
  const publicOrigin = (JSON.parse(jsonText) as WranglerText).vars?.PUBLIC_ORIGIN;
  if (publicOrigin === undefined) throw new Error(MISSING_MESSAGE);
  return publicOrigin;
}
