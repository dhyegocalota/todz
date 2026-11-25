import type { Header } from 'postal-mime';

export function headersNamed({ headers, name }: { headers: Header[]; name: string }): Header[] {
  return headers.filter((header) => header.key.trim().toLowerCase() === name);
}
