import type { Env } from '../env';
import { SITE_URL } from '../site/site-urls';
import { DIMENSION_SEPARATOR, OTHER_DIMENSION, SUPPORTED_MACOS_MAJORS, UNKNOWN_MACOS } from './metric';

const CHECKSUM_HEAD_METHOD = 'HEAD';

async function isPublishedVersion({ env, version }: { env: Env; version: string }): Promise<boolean> {
  if (env.ASSETS === undefined) throw new Error('the ASSETS binding is missing');
  const checksum = await env.ASSETS.fetch(
    new Request(`${SITE_URL}/download/${version}/Todz-${version}.dmg.sha256`, { method: CHECKSUM_HEAD_METHOD }),
  );
  return checksum.ok;
}

// NB ADR 0082: only a version the deploy staged and a macOS major from the fixed list name a row; anything else counts into other without taking a slot.
export async function appVersionDimensionOf({
  env,
  appVersion,
  macosMajor,
}: {
  env: Env;
  appVersion: string;
  macosMajor: string;
}): Promise<string> {
  const isKnownMajor = macosMajor === UNKNOWN_MACOS || SUPPORTED_MACOS_MAJORS.includes(Number(macosMajor));
  if (!isKnownMajor) return OTHER_DIMENSION;
  if (!(await isPublishedVersion({ env, version: appVersion }))) return OTHER_DIMENSION;
  return `${appVersion}${DIMENSION_SEPARATOR}${macosMajor}`;
}
