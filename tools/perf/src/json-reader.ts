export function recordOf(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`expected an object, got ${JSON.stringify(value)}`);
  return Object.fromEntries(Object.entries(value));
}

export function fieldOf({ value, name }: { value: unknown; name: string }): unknown {
  const record = recordOf(value);
  if (!(name in record)) throw new Error(`the answer has no ${name}`);
  return record[name];
}

export function textOf(value: unknown): string {
  if (typeof value !== 'string') throw new Error(`expected a string, got ${JSON.stringify(value)}`);
  return value;
}

export function numberOf(value: unknown): number {
  if (typeof value !== 'number') throw new Error(`expected a number, got ${JSON.stringify(value)}`);
  return value;
}

export function booleanOf(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error(`expected a boolean, got ${JSON.stringify(value)}`);
  return value;
}

export function listOf(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error(`expected a list, got ${JSON.stringify(value)}`);
  return value;
}
