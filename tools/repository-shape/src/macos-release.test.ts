import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const MACOS_PROJECT = 'apps/macos/project.yml';
const APP_ENTITLEMENTS = 'apps/macos/Todz/Todz.entitlements';
const WIDGETS_ENTITLEMENTS = 'apps/macos/TodzWidgets/TodzWidgets.entitlements';
const APP_INFO_PLIST = 'apps/macos/Todz/Info.plist';
const APP_TARGET_MARKER = '\n  Todz:\n';
const WIDGETS_TARGET_MARKER = '\n  TodzWidgets:\n';
const SCHEMES_MARKER = '\nschemes:\n';
const SPARKLE_REVISION = 'ab7d71291238df6e0492143b120c9b696a35f603';
const SPARKLE_PACKAGE = ['  Sparkle:', '    url: https://github.com/sparkle-project/Sparkle', `    revision: ${SPARKLE_REVISION}`].join(
  '\n',
);
const SPARKLE_FLOATING_PINS = ['exactVersion', 'from:', 'branch:', 'upToNextMajorVersion', 'minVersion'];
const TARGET_SETTING_INDENT = '          ';
const SPARKLE_DEPENDENCY = '- package: Sparkle';
const FEED_URL_REFERENCE = '$(TODZ_UPDATE_FEED_URL)';
const RELEASE_FEED_URL = 'https://todz.app/download/appcast.xml';
const PUBLIC_KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/;
const PUBLIC_KEY_SETTING = /\n\s+SUPublicEDKey: "?([^"\n]+)"?\n/;
const MACH_LOOKUP_KEY = 'com.apple.security.temporary-exception.mach-lookup.global-name';
const MACH_LOOKUP_SUFFIXES = ['-spks', '-spki'];
const FIRST_CAPTURE = 1;
const ONE_DAY_SECONDS = '86400';

function section({ text, from, until }: { text: string; from: string; until: string }): string {
  return text.slice(text.indexOf(from), text.indexOf(until));
}

function project(): string {
  return readRepositoryFile(MACOS_PROJECT);
}

function appTarget(): string {
  return section({ text: project(), from: APP_TARGET_MARKER, until: WIDGETS_TARGET_MARKER });
}

function widgetsTarget(): string {
  return section({ text: project(), from: WIDGETS_TARGET_MARKER, until: SCHEMES_MARKER });
}

function configurationSets({ target, configuration, setting }: { target: string; configuration: string; setting: string }): boolean {
  const pattern = new RegExp(`${configuration}:\\n(?:${TARGET_SETTING_INDENT}.*\\n)*?${TARGET_SETTING_INDENT}${setting}\\n`);
  return pattern.test(target);
}

function machLookupEntry(suffix: string): string {
  return `$(PRODUCT_BUNDLE_IDENTIFIER)${suffix}`;
}

describe('the macOS release settings', () => {
  test('both targets run with the hardened runtime in Release only', () => {
    [appTarget(), widgetsTarget()].forEach((target) => {
      expect(target).toContain('ENABLE_HARDENED_RUNTIME: NO');
      expect(configurationSets({ target, configuration: 'Release', setting: 'ENABLE_HARDENED_RUNTIME: YES' })).toBe(true);
      expect(configurationSets({ target, configuration: 'Debug', setting: 'ENABLE_HARDENED_RUNTIME: YES' })).toBe(false);
    });
  });

  test('Release stops injecting the base entitlements, so no get-task-allow ships', () => {
    [appTarget(), widgetsTarget()].forEach((target) => {
      expect(configurationSets({ target, configuration: 'Release', setting: 'CODE_SIGN_INJECT_BASE_ENTITLEMENTS: NO' })).toBe(true);
      expect(target).not.toContain('CODE_SIGN_INJECT_BASE_ENTITLEMENTS: YES');
    });
  });

  test('Sparkle is pinned to the commit of its tag and only the app depends on it', () => {
    expect(project()).toContain(SPARKLE_PACKAGE);
    SPARKLE_FLOATING_PINS.forEach((pin) => expect(project()).not.toContain(pin));
    expect(appTarget()).toContain(SPARKLE_DEPENDENCY);
    expect(widgetsTarget()).not.toContain(SPARKLE_DEPENDENCY);
  });

  test('Release reads the appcast of todz.app and Debug has no feed', () => {
    expect(appTarget()).toContain(`SUFeedURL: ${FEED_URL_REFERENCE}`);
    expect(project()).toMatch(new RegExp(`Debug:\\n(?:      .*\\n)*?      TODZ_UPDATE_FEED_URL: ""\\n`));
    expect(project()).toMatch(new RegExp(`Release:\\n(?:      .*\\n)*?      TODZ_UPDATE_FEED_URL: ${RELEASE_FEED_URL}\\n`));
  });

  test('the app checks for updates every day through the sandboxed installer', () => {
    expect(appTarget()).toContain('SUEnableInstallerLauncherService: YES');
    expect(appTarget()).toContain('SUEnableAutomaticChecks: YES');
    expect(appTarget()).toContain(`SUScheduledCheckInterval: ${ONE_DAY_SECONDS}`);
  });

  test('the app refuses an appcast that is not signed, and verifies an update before extracting it', () => {
    expect(appTarget()).toContain('SURequireSignedFeed: YES');
    expect(appTarget()).toContain('SUVerifyUpdateBeforeExtraction: YES');
    expect(readRepositoryFile(APP_INFO_PLIST)).toContain('<key>SURequireSignedFeed</key>');
    expect(readRepositoryFile(APP_INFO_PLIST)).toContain('<key>SUVerifyUpdateBeforeExtraction</key>');
  });

  test('the app carries the public key that verifies every update', () => {
    const publicKey = PUBLIC_KEY_SETTING.exec(appTarget())?.[FIRST_CAPTURE];
    expect(publicKey).toMatch(PUBLIC_KEY_PATTERN);
    expect(readRepositoryFile(APP_INFO_PLIST)).toContain('<key>SUPublicEDKey</key>');
  });

  test('the app, and only the app, may look up the two Sparkle installer services', () => {
    MACH_LOOKUP_SUFFIXES.forEach((suffix) => {
      expect(appTarget()).toContain(`- ${machLookupEntry(suffix)}`);
      expect(readRepositoryFile(APP_ENTITLEMENTS)).toContain(`<string>${machLookupEntry(suffix)}</string>`);
    });
    expect(appTarget()).toContain(MACH_LOOKUP_KEY);
    expect(readRepositoryFile(APP_ENTITLEMENTS)).toContain(MACH_LOOKUP_KEY);
    expect(widgetsTarget()).not.toContain(MACH_LOOKUP_KEY);
    expect(readRepositoryFile(WIDGETS_ENTITLEMENTS)).not.toContain(MACH_LOOKUP_KEY);
  });

  test('the generated Info.plist carries the update keys', () => {
    const plist = readRepositoryFile(APP_INFO_PLIST);
    expect(plist).toMatch(/<key>SUFeedURL<\/key>\s*<string>\$\(TODZ_UPDATE_FEED_URL\)<\/string>/);
  });
});
