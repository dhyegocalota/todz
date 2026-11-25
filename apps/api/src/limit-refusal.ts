export enum LimitRefusal {
  TryAgain = 'try-again',
  Unavailable = 'unavailable',
}

export async function limitRefusal({ limiter, key }: { limiter: RateLimit | undefined; key: string }): Promise<LimitRefusal | null> {
  if (limiter === undefined) return LimitRefusal.Unavailable;
  const outcome = await limiter.limit({ key }).catch(() => null);
  if (outcome === null) return LimitRefusal.Unavailable;
  if (outcome.success) return null;
  return LimitRefusal.TryAgain;
}
