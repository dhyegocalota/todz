import { describe, expect, test } from 'vitest';
import { openLoopbackReceiver } from './loopback-receiver';

const NOT_FOUND_STATUS = 404;
const OK_STATUS = 200;

describe('openLoopbackReceiver', () => {
  test('answers the browser and hands the callback parameters to the run', async () => {
    const receiver = await openLoopbackReceiver();
    try {
      const response = await fetch(`${receiver.redirectUri}?code=abc&state=xyz`);

      expect(response.status).toBe(OK_STATUS);
      expect(Object.fromEntries(await receiver.callback())).toEqual({ code: 'abc', state: 'xyz' });
    } finally {
      receiver.close();
    }
  });

  test('listens on a loopback address and answers another path with 404 without ending the wait', async () => {
    const receiver = await openLoopbackReceiver();
    try {
      expect(new URL(receiver.redirectUri).hostname).toBe('127.0.0.1');
      const other = await fetch(new URL('/other', receiver.redirectUri));
      expect(other.status).toBe(NOT_FOUND_STATUS);
      await fetch(`${receiver.redirectUri}?code=later`);
      expect((await receiver.callback()).get('code')).toBe('later');
    } finally {
      receiver.close();
    }
  });
});
