const FENCE = '```';

export function linesOf(lines: string[]): string {
  return `${lines.join('\n')}\n`;
}

export function fenced({ language, text }: { language: string; text: string }): string[] {
  return [`${FENCE}${language}`, text, FENCE, ''];
}
