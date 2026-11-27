import { HttpHeader } from './http-header';

const COOKIE_SEPARATOR = ';';
const COOKIE_VALUE_SEPARATOR = '=';

export function cookieValueOf({ request, name }: { request: Request; name: string }): string | null {
  const header = request.headers.get(HttpHeader.Cookie);
  if (header === null) return null;
  const namePrefix = `${name}${COOKIE_VALUE_SEPARATOR}`;
  const values = header
    .split(COOKIE_SEPARATOR)
    .map((pair) => pair.trim())
    .filter((pair) => pair.startsWith(namePrefix))
    .map((pair) => pair.slice(namePrefix.length));
  const [value, ...duplicates] = values;
  const isUnique = value !== undefined && duplicates.length === 0;
  if (!isUnique || value === '') return null;
  return value;
}

export function cookieHeaderOf({
  name,
  value,
  attributes,
  maxAgeSeconds,
}: {
  name: string;
  value: string;
  attributes: string;
  maxAgeSeconds: number;
}): string {
  return `${name}${COOKIE_VALUE_SEPARATOR}${value}; ${attributes}; Max-Age=${maxAgeSeconds}`;
}
