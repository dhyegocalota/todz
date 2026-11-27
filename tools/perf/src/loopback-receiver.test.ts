import { describe, expect, test } from 'vitest';
import { openLoopbackReceiver } from './loopback-receiver';

const NOT_FOUND_STATUS = 404;
const OK_STATUS = 200;
const BAD_REQUEST_STATUS = 400;
const STATE = 'xyz';

describe('openLoopbackReceiver', () => {
  test('answers the browser and hands the callback parameters to the run', async () => {
    const receiver = await openLoopbackReceiver({ state: STATE });
    try {
      const response = await fetch(`${receiver.redirectUri}?code=abc&state=xyz`);

      expect(response.status).toBe(OK_STATUS);
      expect(Object.fromEntries(await receiver.callback())).toEqual({ code: 'abc', state: 'xyz' });
    } finally {
      receiver.close();
    }
  });

  test('listens on a loopback address and answers another path with 404 without ending the wait', async () => {
    const receiver = await openLoopbackReceiver({ state: STATE });
    try {
      expect(new URL(receiver.redirectUri).hostname).toBe('127.0.0.1');
      const other = await fetch(new URL('/other', receiver.redirectUri));
      expect(other.status).toBe(NOT_FOUND_STATUS);
      await fetch(`${receiver.redirectUri}?code=later&state=${STATE}`);
      expect((await receiver.callback()).get('code')).toBe('later');
    } finally {
      receiver.close();
    }
  });

  test('answers a callback with another state or none with 400 and keeps waiting', async () => {
    const receiver = await openLoopbackReceiver({ state: STATE });
    try {
      const forged = await fetch(`${receiver.redirectUri}?code=forged&state=other`);
      const stateless = await fetch(`${receiver.redirectUri}?code=forged`);
      await fetch(`${receiver.redirectUri}?code=genuine&state=${STATE}`);

      expect([forged.status, stateless.status]).toEqual([BAD_REQUEST_STATUS, BAD_REQUEST_STATUS]);
      expect((await receiver.callback()).get('code')).toBe('genuine');
    } finally {
      receiver.close();
    }
  });
});
