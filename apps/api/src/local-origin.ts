const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1'];

export function isLocalOrigin(origin: string): boolean {
  if (!URL.canParse(origin)) return false;
  return LOCAL_HOSTNAMES.includes(new URL(origin).hostname);
}
