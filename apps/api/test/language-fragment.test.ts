import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import worker from '../src/index';
import { workerEnvWith } from './owner-client';

const SITE_ORIGIN = 'https://todz.app';
const SETTINGS = { PUBLIC_ORIGIN: 'https://api.todz.app', SITE_ORIGIN, SIGN_IN_PROVIDER: 'fake' };
const SEE_OTHER_STATUS = 303;

type EdgeRequest = Request<unknown, IncomingRequestCfProperties>;

async function returnedTo({ path, form }: { path: string; form: Record<string, string> }): Promise<string> {
  const body = new URLSearchParams(form).toString();
  const request = new Request(`${SITE_ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': String(body.length), Origin: SITE_ORIGIN },
    body,
    redirect: 'manual',
  });
  const executionContext = createExecutionContext();
  const response = await worker.fetch(request as EdgeRequest, workerEnvWith(SETTINGS), executionContext);
  await waitOnExecutionContext(executionContext);
  expect(response.status).toBe(SEE_OTHER_STATUS);
  const location = response.headers.get('Location');
  if (location === null) throw new Error('a preference form answers with a Location');
  return location;
}

function switchedTo({ language, returned }: { language: string; returned: string }): Promise<string> {
  return returnedTo({ path: '/language', form: { language, return: returned } });
}

describe('the fragment of a language switch', () => {
  test.each(['ways', 'proactive-day', 'content'])('keeps #%s of the landing and moves it to the twin page', async (anchor) => {
    expect(await switchedTo({ language: 'pt-BR', returned: `/ja/#${anchor}` })).toBe(`/pt-br/#${anchor}`);
    expect(await switchedTo({ language: 'en', returned: `/ja/#${anchor}` })).toBe(`/#${anchor}`);
  });

  test('keeps the query and the fragment together', async () => {
    expect(await switchedTo({ language: 'de', returned: '/?utm=x#ways' })).toBe('/de/?utm=x#ways');
  });

  test.each([
    '/ja/#nowhere',
    '/ja/#WAYS',
    '/ja/#ways%0d%0aSet-Cookie:x=1',
    '/ja/#wa ys',
    '/ja/#',
    '/ja/#ways#ways',
    `/ja/#${'a'.repeat(65)}`,
    '/ja/#javascript:alert(1)',
    '/ja/#/evil.example',
  ])('drops the fragment %j and still returns to the twin page', async (returned) => {
    expect(await switchedTo({ language: 'pt-BR', returned })).toBe('/pt-br/');
  });

  test('drops an anchor that exists on the landing but not on the cloud queue page', async () => {
    expect(await switchedTo({ language: 'pt-BR', returned: '/cloud-queue#ways' })).toBe('/pt-br/cloud-queue');
  });

  test('drops a fragment on a private page', async () => {
    expect(await switchedTo({ language: 'pt-BR', returned: '/admin/metrics#ways' })).toBe('/admin/metrics');
  });

  test.each(['//evil.example/#ways', '/\\evil.example#ways', 'https://evil.example/#ways', '/unknown#ways'])(
    'never lets %j leave the host',
    async (returned) => {
      expect(await switchedTo({ language: 'ja', returned })).toBe('/ja/');
    },
  );

  test('keeps a valid fragment on the theme return too', async () => {
    expect(await returnedTo({ path: '/theme', form: { theme: 'dark', return: '/ja/#ways' } })).toBe('/ja/#ways');
  });
});
