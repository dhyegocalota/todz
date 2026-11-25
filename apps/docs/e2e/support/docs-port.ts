import { createServer } from 'node:net';

export const DOCS_PORT_VARIABLE = 'TODZ_DOCS_PORT';
const LOOPBACK_HOST = '127.0.0.1';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, LOOPBACK_HOST, () => {
      const address = server.address();
      if (address === null || typeof address === 'string') return reject(new Error('no port assigned'));
      server.close(() => resolve(address.port));
    });
  });
}

export async function docsPortOf(): Promise<number> {
  const chosenPort = process.env[DOCS_PORT_VARIABLE];
  if (chosenPort) return Number(chosenPort);
  const port = await freePort();
  process.env[DOCS_PORT_VARIABLE] = String(port);
  return port;
}
