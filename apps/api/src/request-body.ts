import { TASK_BATCH_MAX_SIZE, TASK_NOTES_MAX_LENGTH, TASK_TITLE_MAX_LENGTH } from '@todz/types';
import { HttpHeader } from './http-header';

const BODY_LENGTH_MAX = 4096;
const UTF8_BYTES_PER_CODE_POINT_MAX = 4;
const TASK_JSON_OVERHEAD_BYTES = 1_024;
export const OWNER_BODY_LENGTH_MAX =
  TASK_BATCH_MAX_SIZE * ((TASK_TITLE_MAX_LENGTH + TASK_NOTES_MAX_LENGTH) * UTF8_BYTES_PER_CODE_POINT_MAX + TASK_JSON_OVERHEAD_BYTES);
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

export function isBoundedRequest({ request, maxLength = BODY_LENGTH_MAX }: { request: Request; maxLength?: number }): boolean {
  const contentLength = request.headers.get(HttpHeader.ContentLength);
  if (contentLength === null) return false;
  return CONTENT_LENGTH_PATTERN.test(contentLength) && Number(contentLength) <= maxLength;
}
