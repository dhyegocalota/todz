const PERCENT_DIVISOR = 100;
const FIRST_RANK = 1;

export function percentileOf({ samples, percentile }: { samples: number[]; percentile: number }): number {
  if (samples.length === 0) throw new Error('no samples');
  const sorted = [...samples].sort((first, second) => first - second);
  const rank = Math.max(Math.ceil((percentile / PERCENT_DIVISOR) * sorted.length), FIRST_RANK);
  const sample = sorted[rank - FIRST_RANK];
  if (sample === undefined) throw new Error(`no sample at rank ${rank}`);
  return sample;
}
