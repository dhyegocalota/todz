import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const MACOS_PROJECT = 'apps/macos/project.yml';
const APP_ENTITLEMENTS = 'apps/macos/Todz/Todz.entitlements';
const WIDGETS_ENTITLEMENTS = 'apps/macos/TodzWidgets/TodzWidgets.entitlements';
const APP_INFO_PLIST = 'apps/macos/Todz/Info.plist';
const APP_TARGET_MARKER = '\n  Todz:\n';
const WIDGETS_TARGET_MARKER = '\n  TodzWidgets:\n';
const SCHEMES_MARKER = '\nschemes:\n';
const SPARKLE_PACKAGE = ['  Sparkle:', '    url: https://github.com/sparkle-project/Sparkle', '    exactVersion: 2.10.1'].join('\n');
const SPARKLE_DEPENDENCY = '- package: Sparkle';
const FEED_URL_REFERENCE = '$(TODZ_UPDATE_FEED_URL)';
const RELEASE_FEED_URL = 'https://todz.app/download/appcast.xml';
const RELEASE_ONLY_NO_INJECTION = /Release:\n(?:\s+.*\n)*?\s+CODE_SIGN_INJECT_BASE_ENTITLEMENTS: NO\n/;
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

function machLookupEntry(suffix: string): string {
  return `$(PRODUCT_BUNDLE_IDENTIFIER)${suffix}`;
}

describe('the macOS release settings', () => {
  test('both targets run with the hardened runtime', () => {
    expect(appTarget()).toContain('ENABLE_HARDENED_RUNTIME: YES');
    expect(widgetsTarget()).toContain('ENABLE_HARDENED_RUNTIME: YES');
    expect(project()).not.toContain('ENABLE_HARDENED_RUNTIME: NO');
  });

  test('Release stops injecting the base entitlements, so no get-task-allow ships', () => {
    expect(appTarget()).toMatch(RELEASE_ONLY_NO_INJECTION);
    expect(widgetsTarget()).toMatch(RELEASE_ONLY_NO_INJECTION);
    expect(project()).not.toContain('CODE_SIGN_INJECT_BASE_ENTITLEMENTS: YES');
  });

  test('Sparkle is pinned exactly and only the app depends on it', () => {
    expect(project()).toContain(SPARKLE_PACKAGE);
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
