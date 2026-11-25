import { HttpStatus } from '../http-status';

const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';

export enum LandingNotice {
  None = 'none',
  OpensSoon = 'opens-soon',
}

export async function serveLandingPage({ notice }: { notice: LandingNotice }): Promise<Response> {
  return new Response(notice, { status: HttpStatus.Ok, headers: { 'Content-Type': HTML_CONTENT_TYPE } });
}
