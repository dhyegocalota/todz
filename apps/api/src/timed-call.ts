export type RecordWait = (milliseconds: number) => void;

export async function measured<Value>({ call, record }: { call: () => Value | Promise<Value>; record: RecordWait }): Promise<Value> {
  const startedAt = performance.now();
  try {
    return await call();
  } finally {
    record(performance.now() - startedAt);
  }
}
