import { createHash } from 'node:crypto';
import { type IncomingHttpHeaders, type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, test } from 'vitest';
import { openSocketSignals } from './socket-signals';

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const CHANGED_FRAME = Buffer.concat([Buffer.from([0x81, 'changed'.length]), Buffer.from('changed')]);

type UpgradeServer = { server: Server; origin: string; upgrades: { url: string; headers: IncomingHttpHeaders }[] };

const servers: Server[] = [];

async function startUpgradeServer(): Promise<UpgradeServer> {
  const upgrades: UpgradeServer['upgrades'] = [];
  const server = createServer();
  server.on('upgrade', (request, socket) => {
    upgrades.push({ url: request.url ?? '', headers: request.headers });
    const accept = createHash('sha1').update(`${request.headers['sec-websocket-key']}${WEBSOCKET_GUID}`).digest('base64');
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.write(CHANGED_FRAME);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return { server, origin: `http://127.0.0.1:${port}`, upgrades };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

describe('the socket of the change feed', () => {
  test("Node's WebSocket carries the Authorization header on the upgrade", async () => {
    const { origin, upgrades } = await startUpgradeServer();
    const signals = await openSocketSignals({ origin, token: 'probe', projectId: 'project-1' });
    signals.close();
    expect(upgrades).toHaveLength(1);
    expect(upgrades[0]?.headers.authorization).toBe('Bearer probe');
    expect(upgrades[0]?.url).toBe('/owner/projects/project-1/socket');
  });

  test('a changed message reaches the listener', async () => {
    const { origin } = await startUpgradeServer();
    const signals = await openSocketSignals({ origin, token: 'probe', projectId: 'project-1' });
    await new Promise<void>((resolve) => signals.onChanged(resolve));
    signals.close();
  });
});
