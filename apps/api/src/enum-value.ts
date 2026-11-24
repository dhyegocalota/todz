export function enumValueOf<Value extends string>({
  enumeration,
  configured,
}: {
  enumeration: Record<string, Value>;
  configured: string | undefined;
}): Value | null {
  const value = Object.values(enumeration).find((candidate) => candidate === configured);
  if (value === undefined) return null;
  return value;
}
