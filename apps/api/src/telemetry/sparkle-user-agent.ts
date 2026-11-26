import { UNKNOWN_MACOS } from './metric';

export type SparkleClient = { appVersion: string; macosMajor: string };

const SPARKLE_USER_AGENT_PATTERN = /^Todz\/(\d{1,3}\.\d{1,3}\.\d{1,3}) Sparkle\/\d{1,3}\.\d{1,3}(?:\.\d{1,3})?(?: macOS\/(\d{1,2}))?$/;
const APP_VERSION_GROUP = 1;
const MACOS_MAJOR_GROUP = 2;

export function sparkleClientOf(userAgent: string | null): SparkleClient | null {
  if (userAgent === null) return null;
  const match = SPARKLE_USER_AGENT_PATTERN.exec(userAgent);
  if (match === null) return null;
  const macosMajor = match[MACOS_MAJOR_GROUP];
  return { appVersion: match[APP_VERSION_GROUP]!, macosMajor: macosMajor === undefined ? UNKNOWN_MACOS : macosMajor };
}
