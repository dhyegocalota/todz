export function required<Value>({ value, description }: { value: Value | null | undefined; description: string }): Value {
  if (value === null || value === undefined) throw new Error(`${description} is missing`);
  return value;
}
