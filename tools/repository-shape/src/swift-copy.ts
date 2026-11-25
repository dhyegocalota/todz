export function swiftCopyValue({ text, name }: { text: string; name: string }): string {
  const declaration = new RegExp(`static let ${name} = "((?:[^"\\\\]|\\\\.)*)"`);
  const value = declaration.exec(text)?.[1];
  if (value === undefined) throw new Error(`${name} is not a static let of this file`);
  return value;
}
