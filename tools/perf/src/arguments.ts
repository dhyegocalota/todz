export type ParsedArguments = { command: string | null; flags: Map<string, string | null>; positionals: string[] };

import { UsageError } from './usage-error';

const FLAG_PREFIX = '--';

export function parseArguments(argv: string[]): ParsedArguments {
  const [command, ...rest] = argv;
  const flags = new Map<string, string | null>();
  const positionals: string[] = [];
  rest.forEach((token, index) => {
    const next = rest[index + 1];
    const previous = rest[index - 1];
    if (token.startsWith(FLAG_PREFIX)) {
      const hasValue = next !== undefined && !next.startsWith(FLAG_PREFIX);
      flags.set(token.slice(FLAG_PREFIX.length), hasValue ? next : null);
      return;
    }
    const isFlagValue = previous !== undefined && previous.startsWith(FLAG_PREFIX);
    if (!isFlagValue) positionals.push(token);
  });
  return { command: command === undefined ? null : command, flags, positionals };
}

export function flagValueOf({ parsed, name }: { parsed: ParsedArguments; name: string }): string | null {
  if (!parsed.flags.has(name)) return null;
  const value = parsed.flags.get(name);
  if (value === undefined || value === null) throw new UsageError(`--${name} needs a value`);
  return value;
}

export function numberFlagOf({ parsed, name }: { parsed: ParsedArguments; name: string }): number {
  const value = flagValueOf({ parsed, name });
  const number = Number(value);
  if (value === null || !Number.isFinite(number) || number <= 0) throw new UsageError(`--${name} needs a positive number`);
  return number;
}
