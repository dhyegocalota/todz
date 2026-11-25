export enum LandingNotice {
  None = 'none',
  OpensSoon = 'opens-soon',
}

export async function serveLandingPage(_input: { notice: LandingNotice }): Promise<Response> {
  throw new Error('serveLandingPage is not implemented');
}
