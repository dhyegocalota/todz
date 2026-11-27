const KEY_OPENERS = /(?:Localized\.(?:text|attributed)\(|LocalizedStringResource = |IntentDescription\(|Parameter\(title: |shortTitle: )"/g;
const CATALOG_PLACEHOLDER = /%(?:\d+\$)?(?:@|lld|d|lf|f)/g;
const INTERPOLATION_OPENER = '\\(';
const SHAPE_PLACEHOLDER = '%';

function literalFrom({ text, start }: { text: string; start: number }): string {
  let index = start;
  let depth = 0;
  while (index < text.length) {
    const pair = text.slice(index, index + 2);
    if (pair === INTERPOLATION_OPENER) {
      depth += 1;
      index += 2;
      continue;
    }
    const character = text.charAt(index);
    if (depth > 0 && character === '(') depth += 1;
    if (depth > 0 && character === ')') depth -= 1;
    if (depth === 0 && pair.startsWith('\\')) {
      index += 2;
      continue;
    }
    if (depth === 0 && character === '"') return text.slice(start, index);
    index += 1;
  }
  throw new Error('A string literal is never closed');
}

export function localizedKeys(source: string): string[] {
  return [...source.matchAll(KEY_OPENERS)].map((match) => literalFrom({ text: source, start: match.index + match[0].length }));
}

function withoutInterpolations(text: string): string {
  let result = '';
  let index = 0;
  while (index < text.length) {
    if (text.slice(index, index + 2) !== INTERPOLATION_OPENER) {
      result += text.charAt(index);
      index += 1;
      continue;
    }
    let depth = 1;
    index += 2;
    while (depth > 0) {
      if (text.charAt(index) === '(') depth += 1;
      if (text.charAt(index) === ')') depth -= 1;
      index += 1;
    }
    result += SHAPE_PLACEHOLDER;
  }
  return result;
}

export function catalogKeyShape(key: string): string {
  return withoutInterpolations(key).replace(CATALOG_PLACEHOLDER, SHAPE_PLACEHOLDER).replace(/\\"/g, '"');
}
