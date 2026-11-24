export function enumValueOf<Value extends string>({
  enumeration,
  candidate,
}: {
  enumeration: Record<string, Value>;
  candidate: string | undefined;
}): Value | null {
  const value = Object.values(enumeration).find((member) => member === candidate);
  if (value === undefined) return null;
  return value;
}
