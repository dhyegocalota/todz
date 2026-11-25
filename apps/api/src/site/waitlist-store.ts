export async function joinWaitlist(_input: { database: D1Database; address: string; now: number }): Promise<boolean> {
  throw new Error('joinWaitlist is not implemented');
}

export async function recordConfirmationFailure(_input: { database: D1Database; address: string; now: number }): Promise<void> {
  throw new Error('recordConfirmationFailure is not implemented');
}
