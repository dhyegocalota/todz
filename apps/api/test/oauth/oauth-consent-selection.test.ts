import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';
import { digestCredential } from '../../src/credential-digest';
import { seedProject, seedSiblingProject } from '../directory-seed';
import {
  CLIENT_NAME,
  HTTPS_REDIRECT_URI,
  LOOPBACK_REDIRECT_URI,
  type SeededOwner,
  authorizeParams,
  clientMetadata,
  connectedClient,
  consentPage,
  decide,
  decodedHtml,
  pkcePair,
  projectChoiceOf,
  registerClient,
  seededOwner,
  signedInBrowser,
  workspaceChoiceOf,
} from './oauth-client';

type ScopeRow = { kind: string; workspace_id: string | null; project_id: string | null };

type Selectable = {
  owner: SeededOwner;
  siblingId: string;
  otherProjectId: string;
  workspaceId: string;
  otherWorkspaceId: string;
};

async function workspaceIdOf(projectId: string): Promise<string> {
  const row = await env.DIRECTORY.prepare('SELECT workspace_id FROM projects WHERE id = ?')
    .bind(projectId)
    .first<{ workspace_id: string }>();
  return row!.workspace_id;
}

async function selectable(): Promise<Selectable> {
  const owner = await seededOwner();
  const siblingId = await seedSiblingProject({ projectId: owner.projectId, name: 'Website' });
  const otherProjectId = await seedProject({ ownerId: owner.ownerId });
  return {
    owner,
    siblingId,
    otherProjectId,
    workspaceId: await workspaceIdOf(owner.projectId),
    otherWorkspaceId: await workspaceIdOf(otherProjectId),
  };
}

async function scopesOfToken(accessToken: string): Promise<ScopeRow[]> {
  const { results } = await env.DIRECTORY.prepare(
    'SELECT oauth_grant_scopes.kind, oauth_grant_scopes.workspace_id, oauth_grant_scopes.project_id FROM oauth_grant_scopes JOIN oauth_tokens ON oauth_tokens.grant_id = oauth_grant_scopes.grant_id WHERE oauth_tokens.digest = ? ORDER BY oauth_grant_scopes.kind, oauth_grant_scopes.workspace_id, oauth_grant_scopes.project_id',
  )
    .bind(await digestCredential(accessToken))
    .all<ScopeRow>();
  return results;
}

async function codeCount(): Promise<number> {
  const row = await env.DIRECTORY.prepare('SELECT count(*) AS total FROM oauth_codes').first<{ total: number }>();
  return row!.total;
}

async function freshParams(fields: Record<string, string> = {}): Promise<URLSearchParams> {
  const clientId = await registerClient();
  const { challenge } = await pkcePair();
  return authorizeParams({ clientId, challenge, fields });
}

async function refusedChoice({
  owner,
  choices,
  fields,
}: {
  owner: SeededOwner;
  choices: string[];
  fields?: Record<string, string>;
}): Promise<void> {
  const params = await freshParams(fields);
  const browser = await signedInBrowser({ params, email: owner.email });
  const codesBefore = await codeCount();

  const response = await decide({ browser, params, fields: { decision: 'approve' }, choices });

  expect(response.status).toBe(400);
  expect(response.headers.get('Location')).toBeNull();
  expect(await codeCount()).toBe(codesBefore);
}

describe('approving a selection', () => {
  test('two projects of different workspaces are granted as exactly those two, and the token scope names both', async () => {
    const { owner, otherProjectId } = await selectable();

    const { tokens } = await connectedClient({
      choiceOf: () => [projectChoiceOf(owner.projectId), projectChoiceOf(otherProjectId)],
      email: owner.email,
    });

    expect(tokens.scope.split(' ').sort()).toEqual([projectChoiceOf(owner.projectId), projectChoiceOf(otherProjectId)].sort());
    const rows = await scopesOfToken(tokens.access_token);
    expect(rows.map((row) => row.project_id).sort()).toEqual([owner.projectId, otherProjectId].sort());
    rows.forEach((row) => expect(row.kind).toBe('project'));
  });

  test('a ticked workspace is granted whole, and a refresh answers the same scope', async () => {
    const { owner, workspaceId } = await selectable();

    const { tokens } = await connectedClient({ choiceOf: () => workspaceChoiceOf(workspaceId), email: owner.email });

    expect(tokens.scope).toBe(workspaceChoiceOf(workspaceId));
    expect(await scopesOfToken(tokens.access_token)).toEqual([{ kind: 'workspace', workspace_id: workspaceId, project_id: null }]);
  });

  test('a workspace plus a project elsewhere lists workspaces first, then projects', async () => {
    const { owner, workspaceId, otherProjectId } = await selectable();

    const { tokens } = await connectedClient({
      choiceOf: () => [projectChoiceOf(otherProjectId), workspaceChoiceOf(workspaceId)],
      email: owner.email,
    });

    expect(tokens.scope).toBe(`${workspaceChoiceOf(workspaceId)} ${projectChoiceOf(otherProjectId)}`);
  });

  test('a project of a ticked workspace folds into the workspace', async () => {
    const { owner, workspaceId, siblingId, otherProjectId } = await selectable();

    const { tokens } = await connectedClient({
      choiceOf: () => [
        workspaceChoiceOf(workspaceId),
        projectChoiceOf(siblingId),
        projectChoiceOf(owner.projectId),
        projectChoiceOf(otherProjectId),
      ],
      email: owner.email,
    });

    expect(tokens.scope).toBe(`${workspaceChoiceOf(workspaceId)} ${projectChoiceOf(otherProjectId)}`);
    expect(await scopesOfToken(tokens.access_token)).toHaveLength(2);
  });

  test('one project, even ticked twice, is granted as that project alone', async () => {
    const { owner } = await selectable();

    const { tokens } = await connectedClient({
      choiceOf: () => [projectChoiceOf(owner.projectId), projectChoiceOf(owner.projectId)],
      email: owner.email,
    });

    expect(tokens.scope).toBe(projectChoiceOf(owner.projectId));
    expect(await scopesOfToken(tokens.access_token)).toEqual([{ kind: 'project', workspace_id: null, project_id: owner.projectId }]);
  });

  test('the whole account is an explicit account scope with the token scope owner', async () => {
    const { owner } = await selectable();

    const { tokens } = await connectedClient({ choiceOf: () => 'owner', email: owner.email });

    expect(tokens.scope).toBe('owner');
    expect(await scopesOfToken(tokens.access_token)).toEqual([{ kind: 'account', workspace_id: null, project_id: null }]);
  });
});

describe('a choice the server refuses', () => {
  test('the whole account mixed with a project', async () => {
    const { owner } = await selectable();

    await refusedChoice({ owner, choices: ['owner', projectChoiceOf(owner.projectId)] });
  });

  test('the whole account mixed with a workspace', async () => {
    const { owner, workspaceId } = await selectable();

    await refusedChoice({ owner, choices: [workspaceChoiceOf(workspaceId), 'owner'] });
  });

  test('a project of another owner in a selection of the owner own projects', async () => {
    const { owner } = await selectable();
    const stranger = await seededOwner();

    await refusedChoice({ owner, choices: [projectChoiceOf(owner.projectId), projectChoiceOf(stranger.projectId)] });
  });

  test('a workspace of another owner', async () => {
    const { owner } = await selectable();
    const stranger = await seededOwner();

    await refusedChoice({ owner, choices: [workspaceChoiceOf(await workspaceIdOf(stranger.projectId))] });
  });

  test.each([['a bare project id'], ['a team:1 choice'], ['an empty project'], ['an empty workspace']])('%s', async (name) => {
    const { owner } = await selectable();
    const choice = {
      'a bare project id': owner.projectId,
      'a team:1 choice': 'team:1',
      'an empty project': 'project:',
      'an empty workspace': 'workspace:',
    }[name]!;

    await refusedChoice({ owner, choices: [choice] });
  });

  test('no choice at all', async () => {
    const { owner } = await selectable();

    await refusedChoice({ owner, choices: [] });
  });

  test('a selection when the client asked for owner scope only', async () => {
    const { owner } = await selectable();

    await refusedChoice({ owner, choices: [projectChoiceOf(owner.projectId)], fields: { scope: 'owner' } });
  });

  test('the whole account when the client asked for project scope only', async () => {
    const { owner } = await selectable();

    await refusedChoice({ owner, choices: ['owner'], fields: { scope: 'project' } });
  });
});

describe('what the client already holds', () => {
  async function pageOf({
    owner,
    clientName = CLIENT_NAME,
    redirectUri = LOOPBACK_REDIRECT_URI,
  }: {
    owner: SeededOwner;
    clientName?: string;
    redirectUri?: string;
  }): Promise<string> {
    const clientId = await registerClient({ metadata: clientMetadata({ client_name: clientName, redirect_uris: [redirectUri] }) });
    const { challenge } = await pkcePair();
    const params = authorizeParams({ clientId, challenge, redirectUri });
    const browser = await signedInBrowser({ params, email: owner.email });
    return consentPage({ browser, params });
  }

  async function nameWorkspace({ projectId, name }: { projectId: string; name: string }): Promise<void> {
    await env.DIRECTORY.prepare('UPDATE workspaces SET name = ? WHERE id = (SELECT workspace_id FROM projects WHERE id = ?)')
      .bind(name, projectId)
      .run();
  }

  test('names the projects and the account the client name already holds for the owner', async () => {
    const { owner } = await selectable();
    await nameWorkspace({ projectId: owner.projectId, name: 'SuperDoc' });
    await connectedClient({ choiceOf: () => projectChoiceOf(owner.projectId), email: owner.email });
    await connectedClient({ choiceOf: () => 'owner', email: owner.email });

    const html = decodedHtml(await pageOf({ owner }));

    expect(html).toContain('Claude Code already has: SuperDoc › Project; Your whole account');
  });

  test('names a whole workspace by its name', async () => {
    const { owner, workspaceId } = await selectable();
    await nameWorkspace({ projectId: owner.projectId, name: 'SuperDoc' });
    await connectedClient({ choiceOf: () => workspaceChoiceOf(workspaceId), email: owner.email });

    const html = decodedHtml(await pageOf({ owner }));

    expect(html).toContain('Claude Code already has: SuperDoc');
  });

  test('says nothing when the client name holds nothing', async () => {
    const { owner } = await selectable();

    expect(await pageOf({ owner })).not.toContain('already has');
  });

  test('never names what another client name holds', async () => {
    const { owner } = await selectable();
    await connectedClient({ choiceOf: () => projectChoiceOf(owner.projectId), email: owner.email });

    expect(await pageOf({ owner, clientName: 'Cursor' })).not.toContain('already has');
  });

  test('never names what a look-alike client with the same name but another redirect host holds', async () => {
    const { owner } = await selectable();
    await connectedClient({ choiceOf: () => projectChoiceOf(owner.projectId), email: owner.email });

    expect(await pageOf({ owner, redirectUri: HTTPS_REDIRECT_URI })).not.toContain('already has');
  });

  test('never names what another owner holds under the same client name', async () => {
    const { owner } = await selectable();
    const stranger = await seededOwner();
    await connectedClient({ choiceOf: () => projectChoiceOf(stranger.projectId), email: stranger.email });

    expect(await pageOf({ owner })).not.toContain('already has');
  });

  test('escapes a hostile workspace name', async () => {
    const { owner } = await selectable();
    await nameWorkspace({ projectId: owner.projectId, name: '<img src=x onerror=alert(1)>' });
    await connectedClient({ choiceOf: () => projectChoiceOf(owner.projectId), email: owner.email });

    const html = await pageOf({ owner });

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('already has: &lt;img src=x onerror=alert(1)&gt; › Project');
  });
});
