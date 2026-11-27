import { createServer } from 'node:http';
import { MILLISECONDS_PER_MINUTE } from '@todz/types';
import type { LoopbackReceiver } from './oauth-authorize';

const LOOPBACK_HOST = '127.0.0.1';
const CALLBACK_PATH = '/callback';
const EPHEMERAL_PORT = 0;
const CALLBACK_WAIT_MS = 5 * MILLISECONDS_PER_MINUTE;
const CLOSE_TAB_TEXT = 'todz perf is authorized. You can close this tab.';
const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const NOT_FOUND_STATUS = 404;

export function openLoopbackReceiver({ state }: { state: string }): Promise<LoopbackReceiver> {
  return new Promise((resolveReceiver, rejectReceiver) => {
    const callback = new Promise<URLSearchParams>((resolveCallback, rejectCallback) => {
      const server = createServer((request, response) => {
        if (request.url === undefined) {
          response.writeHead(BAD_REQUEST_STATUS).end();
          return;
        }
        const url = new URL(request.url, `http://${LOOPBACK_HOST}`);
        if (url.pathname !== CALLBACK_PATH) {
          response.writeHead(NOT_FOUND_STATUS).end();
          return;
        }
        const isExpectedState = url.searchParams.get('state') === state;
        if (!isExpectedState) {
          response.writeHead(BAD_REQUEST_STATUS).end();
          return;
        }
        response.writeHead(OK_STATUS, { 'Content-Type': 'text/plain' }).end(CLOSE_TAB_TEXT);
        resolveCallback(url.searchParams);
      });
      const timer = setTimeout(() => rejectCallback(new Error('the authorization was not approved in 5 minutes')), CALLBACK_WAIT_MS);
      server.listen(EPHEMERAL_PORT, LOOPBACK_HOST, () => {
        const address = server.address();
        if (address === null || typeof address === 'string') {
          rejectReceiver(new Error('the loopback receiver has no port'));
          return;
        }
        resolveReceiver({
          redirectUri: `http://${LOOPBACK_HOST}:${address.port}${CALLBACK_PATH}`,
          callback: () => callback,
          close: () => {
            clearTimeout(timer);
            server.close();
          },
        });
      });
    });
  });
}
