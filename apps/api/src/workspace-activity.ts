export function isActivityWriteDue({ writtenAt, now }: { writtenAt: number | null; now: number }): boolean {
  throw new Error(`isActivityWriteDue is not implemented for ${writtenAt} and ${now}`);
}
