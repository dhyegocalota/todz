import fs from 'node:fs';
import path from 'node:path';
import { PERSIST_FOLDER_VARIABLE } from './persist-folder';
import { SERVER_LOG_FILE_NAME } from './site-environment';

const LOGGED_MESSAGE_START = '{"to":';

type MailedMessage = { to: string; text: string };

function serverLogPath(): string {
  const persistFolder = process.env[PERSIST_FOLDER_VARIABLE];
  if (persistFolder === undefined) throw new Error('the Playwright configuration did not create the persist folder');
  return path.join(persistFolder, SERVER_LOG_FILE_NAME);
}

export function mailCountTo(address: string): number {
  return fs
    .readFileSync(serverLogPath(), 'utf8')
    .split('\n')
    .filter((line) => line.includes(LOGGED_MESSAGE_START))
    .map((line) => JSON.parse(line.slice(line.indexOf(LOGGED_MESSAGE_START))) as MailedMessage)
    .filter((message) => message.to === address).length;
}
