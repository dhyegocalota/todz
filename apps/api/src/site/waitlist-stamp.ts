export enum StampVerdict {
  Patient = 'patient',
  Missing = 'missing',
  Forged = 'forged',
  TooFast = 'too-fast',
}

export function renderStampOf(_: { secret: string; renderedAt: number }): Promise<string> {
  throw new Error('renderStampOf is not implemented');
}

export function stampVerdictOf(_: { secret: string; stamp: string | undefined; now: number }): Promise<StampVerdict> {
  throw new Error('stampVerdictOf is not implemented');
}
