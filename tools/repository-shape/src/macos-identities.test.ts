import { describe, expect, test } from 'vitest';
import { readRepositoryFile } from './repository-files';

const MACOS_PROJECT = 'apps/macos/project.yml';
const GENERATED_FILES = [
  'apps/macos/Todz/Info.plist',
  'apps/macos/Todz/Todz.entitlements',
  'apps/macos/TodzWidgets/Info.plist',
  'apps/macos/TodzWidgets/TodzWidgets.entitlements',
];
const APP_INFO_PLIST = 'apps/macos/Todz/Info.plist';
const WIDGETS_INFO_PLIST = 'apps/macos/TodzWidgets/Info.plist';
const URL_SCHEME_REFERENCE = '$(TODZ_URL_SCHEME)';
const APP_GROUP_REFERENCE = '$(TeamIdentifierPrefix)$(TODZ_APP_GROUP)';
const APP_GROUP_LITERAL_PATTERN = /dev\.todz<|dev\.todz\n/;
const FIRST_CAPTURE = 1;

type Configuration = 'Debug' | 'Release';

function configurationSetting({ configuration, name }: { configuration: Configuration; name: string }): string | undefined {
  const pattern = new RegExp(
    `\\nsettings:\\n  configs:\\n(?:.*\\n)*?    ${configuration}:\\n(?:      .*\\n)*?      ${name}: "?([^"\\n]+)"?\\n`,
  );
  return pattern.exec(readRepositoryFile(MACOS_PROJECT))?.[FIRST_CAPTURE];
}

function occurrences({ text, fragment }: { text: string; fragment: string }): number {
  return text.split(fragment).length - 1;
}

describe('the macOS identities per configuration', () => {
  test('Debug is its own app with its own widgets and App Group, and Release keeps the shipped identities', () => {
    expect(configurationSetting({ configuration: 'Debug', name: 'TODZ_APP_BUNDLE_IDENTIFIER' })).toBe('dev.todz.Todz.debug');
    expect(configurationSetting({ configuration: 'Debug', name: 'TODZ_WIDGETS_BUNDLE_IDENTIFIER' })).toBe('dev.todz.Todz.debug.widgets');
    expect(configurationSetting({ configuration: 'Debug', name: 'TODZ_APP_GROUP' })).toBe('dev.todz.debug');
    expect(configurationSetting({ configuration: 'Release', name: 'TODZ_APP_BUNDLE_IDENTIFIER' })).toBe('dev.todz.Todz');
    expect(configurationSetting({ configuration: 'Release', name: 'TODZ_WIDGETS_BUNDLE_IDENTIFIER' })).toBe('dev.todz.Todz.widgets');
    expect(configurationSetting({ configuration: 'Release', name: 'TODZ_APP_GROUP' })).toBe('dev.todz');
  });

  test('both targets take their bundle identifier from the configuration', () => {
    const project = readRepositoryFile(MACOS_PROJECT);
    expect(project).toContain('PRODUCT_BUNDLE_IDENTIFIER: $(TODZ_APP_BUNDLE_IDENTIFIER)');
    expect(project).toContain('PRODUCT_BUNDLE_IDENTIFIER: $(TODZ_WIDGETS_BUNDLE_IDENTIFIER)');
    expect(project).not.toMatch(/PRODUCT_BUNDLE_IDENTIFIER: dev\.todz/);
  });

  test('both targets name the App Group through the configuration, in the entitlements and in the Info.plist', () => {
    const project = readRepositoryFile(MACOS_PROJECT);
    expect(occurrences({ text: project, fragment: `- ${APP_GROUP_REFERENCE}` })).toBe(2);
    expect(occurrences({ text: project, fragment: `TodzAppGroup: ${APP_GROUP_REFERENCE}` })).toBe(2);
    expect(project).not.toMatch(/\$\(TeamIdentifierPrefix\)dev\.todz/);
  });

  test('the generated plists carry the configuration references and no literal App Group', () => {
    GENERATED_FILES.forEach((path) => {
      const text = readRepositoryFile(path);
      expect(text, path).toContain(APP_GROUP_REFERENCE);
      expect(text, path).not.toMatch(APP_GROUP_LITERAL_PATTERN);
    });
  });

  test('each configuration registers its own link scheme, and Release keeps todz', () => {
    expect(configurationSetting({ configuration: 'Debug', name: 'TODZ_URL_SCHEME' })).toBe('todz-dev');
    expect(configurationSetting({ configuration: 'Release', name: 'TODZ_URL_SCHEME' })).toBe('todz');
  });

  test('the app registers the configuration scheme and both plists name it for the code to read', () => {
    expect(readRepositoryFile(MACOS_PROJECT)).not.toContain('CFBundleURLSchemes: [todz]');
    expect(occurrences({ text: readRepositoryFile(MACOS_PROJECT), fragment: `TodzLinkScheme: ${URL_SCHEME_REFERENCE}` })).toBe(2);
    expect(readRepositoryFile(APP_INFO_PLIST)).toMatch(
      /<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>\$\(TODZ_URL_SCHEME\)<\/string>\s*<\/array>/,
    );
    [APP_INFO_PLIST, WIDGETS_INFO_PLIST].forEach((path) => {
      expect(readRepositoryFile(path), path).toMatch(/<key>TodzLinkScheme<\/key>\s*<string>\$\(TODZ_URL_SCHEME\)<\/string>/);
    });
  });

  test('local networking is allowed in Debug and Release', () => {
    expect(configurationSetting({ configuration: 'Debug', name: 'TODZ_ALLOWS_LOCAL_NETWORKING' })).toBe('YES');
    expect(configurationSetting({ configuration: 'Release', name: 'TODZ_ALLOWS_LOCAL_NETWORKING' })).toBe('YES');
    expect(readRepositoryFile(MACOS_PROJECT)).toContain('NSAllowsLocalNetworking: $(TODZ_ALLOWS_LOCAL_NETWORKING)');
    expect(readRepositoryFile(APP_INFO_PLIST)).toContain('<string>$(TODZ_ALLOWS_LOCAL_NETWORKING)</string>');
  });
});
