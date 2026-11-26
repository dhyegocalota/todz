import http from 'node:http';
import { REPOSITORY } from '@todz/types';

export const FAKE_GITHUB_PORT = 8793;
export const FAKE_GITHUB_STARS = 42;
export const FAKE_GITHUB_STARS_TEXT = '42';
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;
const REPOSITORY_PATHNAME = `/repos/${REPOSITORY.path}`;

export function startFakeGithub(): http.Server {
  const server = http.createServer((request, response) => {
    const isRepositoryRequest = request.url === REPOSITORY_PATHNAME;
    response.writeHead(isRepositoryRequest ? OK_STATUS : NOT_FOUND_STATUS, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(isRepositoryRequest ? { stargazers_count: FAKE_GITHUB_STARS } : { message: 'Not Found' }));
  });
  return server.listen(FAKE_GITHUB_PORT);
}

if (import.meta.url === `file://${process.argv[1]}`) startFakeGithub();
