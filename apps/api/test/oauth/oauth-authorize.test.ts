import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { seedProject, seedSiblingProject } from '../directory-seed';
import {
  CLIENT_STATE,
  HTTPS_REDIRECT_URI,
  LOOPBACK_REDIRECT_URI,
  OAUTH_ORIGIN,
  authorizeParams,
  authorizeRequest,
  browserVisit,
  choicesOf,
  clientMetadata,
  consentPage,
  decide,
  decodedHtml,
  formRequest,
  hiddenFieldsOf,
  newBrowser,
  pkcePair,
  redirectedParams,
  registerClient,
  returnedParams,
  type SeededOwner,
  seededOwner,
  serveOAuthRequest,
  signedInBrowser,
} from './oauth-client';

const OTHER_PORT_LOOPBACK_URI = 'http://127.0.0.1:51000/callback';
const SESSION_COOKIE = '__Host-todz_oauth';

async function freshRequest(fields: Record<string, string> = {}): Promise<URLSearchParams> {
  const clientId = await registerClient({ metadata: clientMetadata({ redirect_uris: [LOOPBACK_REDIRECT_URI, HTTPS_REDIRECT_URI] }) });
  const { challenge } = await pkcePair();
  return authorizeParams({ clientId, challenge, fields });
}

function authorize(params: URLSearchParams): Promise<Response> {
  return serveOAuthRequest({ request: authorizeRequest(params) });
}

async function nameProjectAndWorkspace({
  projectId,
  projectName,
  workspaceName,
}: {
  projectId: string;
  projectName: string;
  workspaceName: string;
}): Promise<void> {
  await env.DIRECTORY.batch([
    env.DIRECTORY.prepare('UPDATE projects SET name = ? WHERE id = ?').bind(projectName, projectId),
    env.DIRECTORY.prepare('UPDATE workspaces SET name = ? WHERE id = (SELECT workspace_id FROM projects WHERE id = ?)').bind(
      workspaceName,
      projectId,
    ),
  ]);
}

function choiceLabelOf({ html, choice }: { html: string; choice: string }): string | undefined {
  return new RegExp(`value="${choice}"[^>]*><span>([^<]*)</span>`).exec(html)?.[1];
}

function withParams({ params, changes }: { params: URLSearchParams; changes: Record<string, string | null> }): URLSearchParams {
  const changed = new URLSearchParams(params);
  Object.entries(changes).forEach(([name, value]) => {
    if (value === null) {
      changed.delete(name);
      return;
    }
    changed.set(name, value);
  });
  return changed;
}

describe('authorize refuses without redirecting until the client and its redirect URI are known', () => {
  test.each([
    ['an unknown client', { client_id: 'unknownunknownunknownunknownunknownunknown0' }],
    ['no client', { client_id: null }],
    ['no redirect URI', { redirect_uri: null }],
    ['an unregistered path', { redirect_uri: 'http://127.0.0.1:33418/elsewhere' }],
    ['an unregistered host', { redirect_uri: 'https://attacker.example/oauth/callback' }],
    ['an added query', { redirect_uri: `${HTTPS_REDIRECT_URI}?next=https://attacker.example` }],
    ['another port on an https URI', { redirect_uri: 'https://client.example.com:8443/oauth/callback' }],
    ['plain http for the https URI', { redirect_uri: 'http://client.example.com/oauth/callback' }],
  ])('%s renders an error page', async (_label, changes) => {
    const params = withParams({ params: await freshRequest(), changes });

    const response = await authorize(params);

    expect(response.status).toBe(400);
    expect(response.headers.get('Location')).toBeNull();
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(decodedHtml(await response.text())).toContain("This link can't be used to connect an app");
  });

  test('a repeated client id renders an error page', async () => {
    const params = await freshRequest();
    params.append('client_id', 'another');

    const response = await authorize(params);

    expect(response.status).toBe(400);
    expect(response.headers.get('Location')).toBeNull();
  });

  test('a loopback redirect URI may change its port', async () => {
    const params = withParams({ params: await freshRequest(), changes: { redirect_uri: OTHER_PORT_LOOPBACK_URI } });

    const response = await authorize(params);

    expect(response.status).toBe(200);
  });
});

describe('authorize redirects its other errors with the state and the issuer', () => {
  test.each([
    ['the implicit response type', { response_type: 'token' }, 'unsupported_response_type'],
    ['no response type', { response_type: null }, 'invalid_request'],
    ['no code challenge', { code_challenge: null }, 'invalid_request'],
    ['a malformed code challenge', { code_challenge: 'short' }, 'invalid_request'],
    ['the plain method', { code_challenge_method: 'plain' }, 'invalid_request'],
    ['no method', { code_challenge_method: null }, 'invalid_request'],
    ['another resource', { resource: 'https://attacker.example/mcp' }, 'invalid_target'],
    ['only unknown scope words', { scope: 'email profile' }, 'invalid_scope'],
  ])('%s', async (_label, changes, error) => {
    const params = withParams({ params: await freshRequest(), changes });

    const redirected = redirectedParams(await authorize(params));

    expect(redirected.get('error')).toBe(error);
    expect(redirected.get('state')).toBe(CLIENT_STATE);
    expect(redirected.get('iss')).toBe(OAUTH_ORIGIN);
    expect(redirected.get('code')).toBeNull();
  });

  test('the error goes to the redirect URI the request named', async () => {
    const params = withParams({ params: await freshRequest(), changes: { redirect_uri: OTHER_PORT_LOOPBACK_URI, response_type: 'token' } });

    const response = await authorize(params);

    expect(response.headers.get('Location')).toMatch(/^http:\/\/127\.0\.0\.1:51000\/callback\?/);
  });
});

describe('authorize without a browser session asks for the email address', () => {
  test('the page carries the request and the Turnstile widget', async () => {
    const params = await freshRequest();

    const response = await authorize(params);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const html = await response.text();
    expect(html).toContain('action="/oauth/sign-in-links"');
    expect(html).toContain('class="cf-turnstile"');
    expect(html).toContain('data-action="request_link"');
    expect(hiddenFieldsOf(html).request).toBe(params.toString());
    expect(html).toContain('Claude Code');
  });

  test('a client name is escaped', async () => {
    const clientId = await registerClient({ metadata: clientMetadata({ client_name: '<img src=x onerror=alert(1)>' }) });
    const { challenge } = await pkcePair();

    const html = await (await authorize(authorizeParams({ clientId, challenge }))).text();

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('the consent screen', () => {
  test('names the app and the redirect host, preselects the first project and leaves the owner scope off', async () => {
    const owner = await seededOwner();
    const siblingId = await seedSiblingProject({ projectId: owner.projectId, name: 'Website' });
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });

    const html = await consentPage({ browser, params });

    expect(html).toContain('Claude Code');
    expect(html).toContain('127.0.0.1');
    expect(html).toContain('this computer');
    expect(choicesOf(html)).toEqual([owner.projectId, siblingId, 'owner']);
    expect(html).toMatch(new RegExp(`value="${owner.projectId}" checked`));
    expect(html).not.toMatch(/value="owner" checked/);
    expect(html).toContain('Your whole account (owner scope)');
    expect(html).toContain('It can read and change every task, and create, rename and delete every workspace and project.');
    expect(decodedHtml(html)).toContain(
      "A project lets it read and change that project's tasks, and move them to the other projects of its workspace.",
    );
  });

  test('each project choice names its workspace, so two inboxes never read alike', async () => {
    const owner = await seededOwner();
    const otherProjectId = await seedProject({ ownerId: owner.ownerId });
    await nameProjectAndWorkspace({ projectId: owner.projectId, projectName: 'Inbox', workspaceName: 'Thrifty Traveler' });
    await nameProjectAndWorkspace({ projectId: otherProjectId, projectName: 'Inbox', workspaceName: 'Personal' });
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });

    const html = decodedHtml(await consentPage({ browser, params }));

    expect(choiceLabelOf({ html, choice: owner.projectId })).toBe('Thrifty Traveler › Inbox');
    expect(choiceLabelOf({ html, choice: otherProjectId })).toBe('Personal › Inbox');
  });

  test('an unknown decision is refused, never answered with an error', async () => {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });

    const response = await decide({ browser, params, fields: { decision: 'toString', choice: owner.projectId } });

    expect(response.status).toBe(400);
    expect(response.headers.get('Location')).toBeNull();
  });

  test('a decision ends the browser session', async () => {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });
    const replayed = newBrowser();
    replayed.cookies.set(SESSION_COOKIE, browser.cookies.get(SESSION_COOKIE)!);

    const response = await decide({ browser, params, fields: { decision: 'deny', choice: owner.projectId } });

    expect(response.headers.getSetCookie().some((cookie) => cookie.startsWith(`${SESSION_COOKIE}=;`) && cookie.includes('Max-Age=0'))).toBe(
      true,
    );
    const again = await browserVisit({ browser: replayed, request: authorizeRequest(params) });
    expect(await again.text()).toContain('action="/oauth/sign-in-links"');
  });

  test('a client that asked for project scope only is not offered the owner scope', async () => {
    const owner = await seededOwner();
    const params = await freshRequest({ scope: 'project' });
    const browser = await signedInBrowser({ params, email: owner.email });

    const html = await consentPage({ browser, params });

    expect(choicesOf(html)).toEqual([owner.projectId]);
  });

  test('a client that asked for owner scope only is offered only the owner scope, still off', async () => {
    const owner = await seededOwner();
    const params = await freshRequest({ scope: 'owner' });
    const browser = await signedInBrowser({ params, email: owner.email });

    const html = await consentPage({ browser, params });

    expect(choicesOf(html)).toEqual(['owner']);
    expect(html).not.toMatch(/value="owner" checked/);
  });

  test('a page answer forbids framing and allows forms only to itself and the redirect origin', async () => {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });

    const response = await browserVisit({ browser, request: authorizeRequest(params) });

    const policy = response.headers.get('Content-Security-Policy');
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("form-action 'self' http://127.0.0.1:33418");
  });

  test.each([
    ['a project', (owner: SeededOwner) => owner.projectId],
    ['the whole account', () => 'owner'],
  ])(
    'approving %s answers a page that returns to the client with a code, the state and the issuer, never a redirect a form policy could block',
    async (_name, choiceOf) => {
      const owner = await seededOwner();
      const params = await freshRequest();
      const browser = await signedInBrowser({ params, email: owner.email });

      const response = await decide({ browser, params, fields: { decision: 'approve', choice: choiceOf(owner) } });

      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
      const returned = await returnedParams(response);
      expect(returned.get('code')).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(returned.get('state')).toBe(CLIENT_STATE);
      expect(returned.get('iss')).toBe(OAUTH_ORIGIN);
    },
  );

  test('the consent form keeps Approve busy once submitted, so a second press never posts again', async () => {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });

    const html = await consentPage({ browser, params });

    expect(html).toContain('<form class="join-form consent-form"');
    expect(html).toMatch(/<button class="join-button" type="submit" name="decision" value="approve" data-submitting="Approving…">/);
  });

  test('denying answers a page that returns to the client with access_denied and the state', async () => {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });

    const redirected = await returnedParams(await decide({ browser, params, fields: { decision: 'deny', choice: owner.projectId } }));

    expect(redirected.get('error')).toBe('access_denied');
    expect(redirected.get('state')).toBe(CLIENT_STATE);
    expect(redirected.get('code')).toBeNull();
  });

  test('a project of another owner cannot be chosen', async () => {
    const owner = await seededOwner();
    const stranger = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });

    const response = await decide({ browser, params, fields: { decision: 'approve', choice: stranger.projectId } });

    expect(response.status).toBe(400);
    expect(response.headers.get('Location')).toBeNull();
  });

  test('the owner scope cannot be chosen when the client asked for project scope only', async () => {
    const owner = await seededOwner();
    const params = await freshRequest({ scope: 'project' });
    const browser = await signedInBrowser({ params, email: owner.email });

    const response = await decide({ browser, params, fields: { decision: 'approve', choice: 'owner' } });

    expect(response.status).toBe(400);
    expect(response.headers.get('Location')).toBeNull();
  });
});

describe('a decision comes only from the consent form the server rendered', () => {
  test.each([
    ['a decision', { decision: 'approve' }],
    ['a choice', { choice: 'owner' }],
    ['a form token', { form_token: 'smuggled' }],
  ])('an authorize query carrying %s is refused without redirecting', async (_name, fields) => {
    const params = await freshRequest(fields);

    const response = await authorize(params);

    expect(response.status).toBe(400);
    expect(response.headers.get('Location')).toBeNull();
  });

  test('a signed-in browser opening a query that carries a decision gets no consent form', async () => {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });
    const smuggled = withParams({ params, changes: { decision: 'approve', choice: 'owner' } });

    const response = await browserVisit({ browser, request: authorizeRequest(smuggled) });

    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain('name="form_token"');
  });

  test('the consent form carries only the authorization parameters and its form token', async () => {
    const owner = await seededOwner();
    const params = await freshRequest({ prompt: 'consent' });
    const browser = await signedInBrowser({ params, email: owner.email });

    const html = await consentPage({ browser, params });

    const hiddenNames = Object.keys(hiddenFieldsOf(html));
    expect(hiddenNames).toContain('form_token');
    expect(hiddenNames).toContain('client_id');
    expect(hiddenNames).not.toContain('prompt');
  });

  test.each([
    [
      'decision',
      [
        ['decision', 'deny'],
        ['decision', 'approve'],
      ],
    ],
    [
      'choice',
      [
        ['decision', 'approve'],
        ['choice', 'owner'],
        ['choice', 'owner'],
      ],
    ],
    [
      'form token',
      [
        ['decision', 'approve'],
        ['choice', 'owner'],
        ['form_token', 'smuggled'],
      ],
    ],
  ] as [string, [string, string][]][])('a body that repeats the %s is refused and yields no code', async (_name, extra) => {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });
    const html = await consentPage({ browser, params });

    const response = await browserVisit({
      browser,
      request: formRequest({ path: '/oauth/authorize', fields: [...Object.entries(hiddenFieldsOf(html)), ...extra] }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('Location')).toBeNull();
  });

  test('Deny never yields a code, whatever choice the body carries', async () => {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });

    const redirected = await returnedParams(await decide({ browser, params, fields: { decision: 'deny', choice: 'owner' } }));

    expect(redirected.get('code')).toBeNull();
    expect(redirected.get('error')).toBe('access_denied');
  });
});

describe('the consent form is bound to its session, its request and its origin', () => {
  async function consentFields(): Promise<{
    owner: Awaited<ReturnType<typeof seededOwner>>;
    params: URLSearchParams;
    fields: Record<string, string>;
  }> {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });
    const html = await consentPage({ browser, params });
    return { owner, params, fields: { ...hiddenFieldsOf(html), decision: 'approve', choice: owner.projectId } };
  }

  test('a post without the form token is refused', async () => {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });
    const html = await consentPage({ browser, params });
    const { form_token: _formToken, ...withoutToken } = hiddenFieldsOf(html);

    const response = await browserVisit({
      browser,
      request: formRequest({ path: '/oauth/authorize', fields: { ...withoutToken, decision: 'approve', choice: owner.projectId } }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get('Location')).toBeNull();
  });

  test('the form token of one session does not work in another', async () => {
    const { owner, fields } = await consentFields();
    const params = new URLSearchParams(Object.entries(fields).filter(([name]) => !['form_token', 'decision', 'choice'].includes(name)));
    const otherBrowser = await signedInBrowser({ params, email: owner.email });

    const response = await browserVisit({ browser: otherBrowser, request: formRequest({ path: '/oauth/authorize', fields }) });

    expect(response.status).toBe(403);
  });

  test('the form token of one request does not work for another state', async () => {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });
    const html = await consentPage({ browser, params });

    const response = await browserVisit({
      browser,
      request: formRequest({
        path: '/oauth/authorize',
        fields: { ...hiddenFieldsOf(html), state: 'another-state', decision: 'approve', choice: owner.projectId },
      }),
    });

    expect(response.status).toBe(403);
  });

  test('a cross-site post is refused', async () => {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });

    const response = await decide({
      browser,
      params,
      fields: { decision: 'approve', choice: owner.projectId },
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    });

    expect(response.status).toBe(403);
  });

  test('a post with no session cookie gets the email form again', async () => {
    const { fields } = await consentFields();

    const response = await browserVisit({ browser: newBrowser(), request: formRequest({ path: '/oauth/authorize', fields }) });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('action="/oauth/sign-in-links"');
  });

  test.each([
    ['a project', (owner: SeededOwner) => owner.projectId],
    ['the whole account', () => 'owner'],
  ])('an approval of %s posted again says it was already approved, never the email form, and yields no code', async (_name, choiceOf) => {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });
    const fields = { ...hiddenFieldsOf(await consentPage({ browser, params })), decision: 'approve', choice: choiceOf(owner) };
    await browserVisit({ browser, request: formRequest({ path: '/oauth/authorize', fields }) });

    const replayed = await browserVisit({ browser, request: formRequest({ path: '/oauth/authorize', fields }) });

    expect(replayed.status).toBe(200);
    expect(replayed.headers.get('Location')).toBeNull();
    const html = await replayed.text();
    expect(html).toContain('Already approved');
    expect(html).not.toContain('action="/oauth/sign-in-links"');
    expect(html).not.toMatch(/code=/);
  });

  test('a cross-site post of an approved request is refused, never told it was approved', async () => {
    const owner = await seededOwner();
    const params = await freshRequest();
    const browser = await signedInBrowser({ params, email: owner.email });
    const fields = { ...hiddenFieldsOf(await consentPage({ browser, params })), decision: 'approve', choice: owner.projectId };
    await browserVisit({ browser, request: formRequest({ path: '/oauth/authorize', fields }) });

    const replayed = await browserVisit({
      browser,
      request: formRequest({ path: '/oauth/authorize', fields, headers: { 'Sec-Fetch-Site': 'cross-site' } }),
    });

    expect(replayed.status).toBe(403);
    expect(await replayed.text()).not.toContain('Already approved');
  });
});
