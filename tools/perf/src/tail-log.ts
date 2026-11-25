export type TailSummary = { outcomes: Record<string, number>; cpuTimeMedianMs: number; cpuTimeSlowestMs: number; events: number };

export function tailSummaryOf(_: string): TailSummary {
  throw new Error('tailSummaryOf is not implemented');
}
