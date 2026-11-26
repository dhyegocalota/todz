import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parsedBinaryPropertyList, type PropertyListValue } from './binary-property-list';
import { readRepositoryFile, repositoryPath } from './repository-files';

const MACOS_PROJECT = 'apps/macos/project.yml';
const APP_ENTITLEMENTS = 'apps/macos/Todz/Todz.entitlements';
const WIDGETS_ENTITLEMENTS = 'apps/macos/TodzWidgets/TodzWidgets.entitlements';
const APP_INFO_PLIST = 'apps/macos/Todz/Info.plist';
const RELEASE_RUNBOOK = 'docs/runbooks/release-the-mac-app.md';
const AUTOMATIC_UPDATES_SETTING = 'TODZ_AUTOMATICALLY_UPDATES';
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
const RELEASE_SCRIPT = 'scripts/release-mac.sh';
const TYPES_CONSTANTS = 'libs/types/src/constants.ts';
const FIRST_VERSION_PATTERN = /^first_version="([^"]+)"$/m;
const MINIMUM_APP_VERSION_PATTERN = /MINIMUM_APP_VERSION = '([^']+)'/;
const MARKETING_VERSION_PATTERN = /MARKETING_VERSION: "([^"]+)"/g;
const ONE_DAY_SECONDS = '86400';
const DISK_IMAGE_LAYOUT = 'apps/macos/release/dmg-layout.dsstore';
const ICON_VIEW_RECORD_MARKER = Buffer.from('icvpblob', 'latin1');
const RECORD_LENGTH_BYTES = 4;
const ICON_VIEW_COLOUR_KEYS = ['backgroundColorRed', 'backgroundColorGreen', 'backgroundColorBlue'];
const ICON_VIEW_KEYS_FINDER_REQUIRES = [
  ...ICON_VIEW_COLOUR_KEYS,
  'axTextSize',
  'backgroundImageAlias',
  'backgroundType',
  'iconSize',
  'textSize',
];
const ICON_SIZE = 128;
const PICTURE_BACKGROUND_TYPE = 2;
const BACKGROUND_PICTURE_PATH = '/.background/dmg-background.tiff';
const VOLUME_NAME = 'Todz';

function iconViewRecord(): Record<string, PropertyListValue> {
  const layout = readFileSync(repositoryPath(DISK_IMAGE_LAYOUT));
  const marker = layout.indexOf(ICON_VIEW_RECORD_MARKER);
  if (marker < 0) throw new Error('the layout has no icon view record');
  const lengthStart = marker + ICON_VIEW_RECORD_MARKER.length;
  const recordStart = lengthStart + RECORD_LENGTH_BYTES;
  const record = layout.subarray(recordStart, recordStart + layout.readUInt32BE(lengthStart));
  return parsedBinaryPropertyList(record) as Record<string, PropertyListValue>;
}

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

describe('the version the app sends and the version Sparkle updates from', () => {
  test('the first release and the project version are one version, and the oldest app the server accepts is not older', () => {
    const firstRelease = FIRST_VERSION_PATTERN.exec(readRepositoryFile(RELEASE_SCRIPT))?.[FIRST_CAPTURE];
    const oldestAccepted = MINIMUM_APP_VERSION_PATTERN.exec(readRepositoryFile(TYPES_CONSTANTS))?.[FIRST_CAPTURE];
    const marketingVersions = [...project().matchAll(MARKETING_VERSION_PATTERN)].map((match) => match[FIRST_CAPTURE]);
    expect(firstRelease).toBeDefined();
    expect(marketingVersions).toEqual([firstRelease, firstRelease]);
    expect(oldestAccepted).toBeDefined();
    expect(String(oldestAccepted).localeCompare(String(firstRelease), undefined, { numeric: true })).toBeGreaterThanOrEqual(0);
  });

  test('the release command gives xcodebuild the version and the build number the appcast names', () => {
    const script = readRepositoryFile(RELEASE_SCRIPT);
    expect(script).toContain('MARKETING_VERSION="$version"');
    expect(script).toContain('CURRENT_PROJECT_VERSION="$build"');
    expect(script).toContain('<sparkle:version>$build</sparkle:version>');
    expect(script).toContain('<sparkle:shortVersionString>$version</sparkle:shortVersionString>');
  });
});

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

  test('automatic updates are a build setting that only the release command turns on', () => {
    expect(appTarget()).toContain(`SUAutomaticallyUpdate: $(${AUTOMATIC_UPDATES_SETTING})`);
    expect(project()).toMatch(new RegExp(`Debug:\\n(?:      .*\\n)*?      ${AUTOMATIC_UPDATES_SETTING}: "NO"\\n`));
    expect(project()).toMatch(new RegExp(`Release:\\n(?:      .*\\n)*?      ${AUTOMATIC_UPDATES_SETTING}: "NO"\\n`));
    expect(readRepositoryFile(APP_INFO_PLIST)).toMatch(
      new RegExp(`<key>SUAutomaticallyUpdate<\\/key>\\s*<string>\\$\\(${AUTOMATIC_UPDATES_SETTING}\\)<\\/string>`),
    );
    expect(readRepositoryFile(RELEASE_SCRIPT)).toContain(`${AUTOMATIC_UPDATES_SETTING}=YES`);
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

  test('the first public release is gated by a local check on this Mac: a quarantined download, Open Anyway and a Sparkle update', () => {
    const runbook = readRepositoryFile(RELEASE_RUNBOOK);
    ['xattr -w com.apple.quarantine', 'Open Anyway', 'Check for Updates…', 'Updated to <version>'].forEach((mention) =>
      expect(runbook).toContain(mention),
    );
  });

  test('the generated Info.plist carries the update keys', () => {
    const plist = readRepositoryFile(APP_INFO_PLIST);
    expect(plist).toMatch(/<key>SUFeedURL<\/key>\s*<string>\$\(TODZ_UPDATE_FEED_URL\)<\/string>/);
  });
});

describe('the disk image layout', () => {
  test('the icon view record carries every key Finder needs to honour the background picture', () => {
    expect(Object.keys(iconViewRecord())).toEqual(expect.arrayContaining(ICON_VIEW_KEYS_FINDER_REQUIRES));
  });

  test('the icon view record asks for 128 point icons on a picture background with its colours present', () => {
    const record = iconViewRecord();
    expect(record.iconSize).toBe(ICON_SIZE);
    expect(record.backgroundType).toBe(PICTURE_BACKGROUND_TYPE);
    ICON_VIEW_COLOUR_KEYS.forEach((key) => expect(typeof record[key]).toBe('number'));
  });

  test('the background alias names the picture in the hidden folder on the volume Todz', () => {
    const alias = (iconViewRecord().backgroundImageAlias as Buffer).toString('latin1');
    expect(alias).toContain(BACKGROUND_PICTURE_PATH);
    expect(alias).toContain(VOLUME_NAME);
  });
});
