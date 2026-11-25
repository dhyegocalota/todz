import { HttpHeader } from './http-header';

const BODY_LENGTH_MAX = 4096;
const CONTENT_LENGTH_PATTERN = /^\d+$/;
const MEDIA_TYPE_PARAMETER_SEPARATOR = ';';

export enum MediaType {
  Form = 'application/x-www-form-urlencoded',
  Json = 'application/json',
}

export function hasMediaType({ request, mediaType }: { request: Request; mediaType: MediaType }): boolean {
  const contentType = request.headers.get(HttpHeader.ContentType);
  if (contentType === null) return false;
  const [declaredMediaType] = contentType.split(MEDIA_TYPE_PARAMETER_SEPARATOR);
  return declaredMediaType?.trim().toLowerCase() === mediaType;
}

export function isBoundedRequest(request: Request): boolean {
  const contentLength = request.headers.get(HttpHeader.ContentLength);
  if (contentLength === null) return false;
  return CONTENT_LENGTH_PATTERN.test(contentLength) && Number(contentLength) <= BODY_LENGTH_MAX;
}
