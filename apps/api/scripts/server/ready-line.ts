const TRAILING_COMMA_PATTERN = /,(\s*[}\]])/g;
const MISSING_MESSAGE = 'PUBLIC_ORIGIN is missing from the Wrangler configuration';

type WranglerText = { vars?: { PUBLIC_ORIGIN?: string } };

export function readyLine({ publicOrigin }: { publicOrigin: string }): string {
  return `todz server ready: ${publicOrigin}  →  paste it in todz › Settings › Server`;
}

export function publicOriginOf(wranglerText: string): string {
  const publicOrigin = (JSON.parse(wranglerText.replace(TRAILING_COMMA_PATTERN, '$1')) as WranglerText).vars?.PUBLIC_ORIGIN;
  if (publicOrigin === undefined) throw new Error(MISSING_MESSAGE);
  return publicOrigin;
}
