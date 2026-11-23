// NB ADR 0009: keys are fractional strings compared as plain strings, and a move writes one key.
export function orderKeyBetween({ before, after }: { before: string | null; after: string | null }): string {
  throw new Error('orderKeyBetween is not implemented');
}
