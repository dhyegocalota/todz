const MCP_PATH = '/mcp';

function urlOf(input: Parameters<typeof fetch>[0]): URL {
  if (typeof input === 'string') return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

export function routedFetch({ mcp, owner }: { mcp: typeof fetch; owner: typeof fetch }): typeof fetch {
  return (input, init) => {
    if (urlOf(input).pathname === MCP_PATH) return mcp(input, init);
    return owner(input, init);
  };
}
