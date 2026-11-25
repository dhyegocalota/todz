export function withServerVersion({ response }: { response: Response; version: string | null }): Response {
  return response;
}
