const LITERAL = '"((?:[^"\\\\]|\\\\.)*)"';

export function swiftCopyValue({ text, name }: { text: string; name: string }): string {
  const localized = new RegExp(`static var ${name}: \\w+ \\{ Localized\\.(?:text|attributed)\\(${LITERAL}\\) \\}`);
  const plain = new RegExp(`static let ${name} = ${LITERAL}`);
  const declaration = localized.exec(text) || plain.exec(text);
  if (!declaration) throw new Error(`${name} is not a static of this file`);
  return declaration[1]!;
}
