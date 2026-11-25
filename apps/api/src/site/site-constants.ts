export const DARK_THEME_COLOR = '#070812';
export const KEY_PLACEHOLDER = '<key>';
const SCRIPT_OPENER = '<';
const ESCAPED_SCRIPT_OPENER = '\\u003c';

export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll(SCRIPT_OPENER, ESCAPED_SCRIPT_OPENER);
}
