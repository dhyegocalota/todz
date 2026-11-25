import { existsSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, test } from 'vitest';
import { readRepositoryFile, repositoryFiles, repositoryPath } from './repository-files';

const SERVED_FOLDER = 'apps/api/public/landing';
const SCREENSHOTS_FOLDER = 'docs/screenshots';
const SHOTS_SOURCE = 'apps/api/src/site/landing-shots.ts';
const SHOT_PATTERN = /path: '\/landing\/([^']+)',\s+width: (\d+),\s+height: (\d+)/g;
const WIDTH_OFFSET = 16;
const HEIGHT_OFFSET = 20;

type ServedShot = { path: string; width: number; height: number };

const SERVED = repositoryFiles(SERVED_FOLDER).map((path) => posix.relative(SERVED_FOLDER, path));

function screenshotOf(path: string): string {
  return posix.join(SCREENSHOTS_FOLDER, path);
}

function servedOf(path: string): string {
  return posix.join(SERVED_FOLDER, path);
}

function shotsTheLandingShows(): ServedShot[] {
  return [...readRepositoryFile(SHOTS_SOURCE).matchAll(SHOT_PATTERN)].flatMap(([, path, width, height]) =>
    path === undefined ? [] : [{ path, width: Number(width), height: Number(height) }],
  );
}

function isByteCopy(path: string): boolean {
  const source = screenshotOf(path);
  if (!existsSync(repositoryPath(source))) return false;
  return readFileSync(repositoryPath(servedOf(path))).equals(readFileSync(repositoryPath(source)));
}

function isIntrinsicSize(shot: ServedShot): boolean {
  const bytes = readFileSync(repositoryPath(servedOf(shot.path)));
  return bytes.readUInt32BE(WIDTH_OFFSET) === shot.width && bytes.readUInt32BE(HEIGHT_OFFSET) === shot.height;
}

describe('the screenshots the landing serves', () => {
  test('there are served screenshots to check', () => {
    expect(SERVED.length).toBeGreaterThan(0);
  });

  test('each is a byte copy of the README screenshot at the same path under docs/screenshots', () => {
    expect(SERVED.filter((path) => !isByteCopy(path))).toEqual([]);
  });

  test('the landing shows exactly the served screenshots, each with its intrinsic width and height', () => {
    const shots = shotsTheLandingShows();
    expect(shots.map(({ path }) => path).sort()).toEqual([...SERVED].sort());
    expect(shots.filter((shot) => !SERVED.includes(shot.path) || !isIntrinsicSize(shot))).toEqual([]);
  });
});
