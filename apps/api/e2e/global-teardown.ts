import fs from 'node:fs';
import { PERSIST_FOLDER_VARIABLE } from './persist-folder';

export default function removePersistFolder(): void {
  const persistFolder = process.env[PERSIST_FOLDER_VARIABLE];
  if (persistFolder === undefined) return;
  fs.rmSync(persistFolder, { recursive: true, force: true });
}
