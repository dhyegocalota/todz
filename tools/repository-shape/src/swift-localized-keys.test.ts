import { describe, expect, test } from 'vitest';
import { catalogKeyShape, localizedKeys, shortcutPhrases } from './swift-localized-keys';

describe('shortcutPhrases', () => {
  test('reads each phrase with the application name as a placeholder', () => {
    const source = 'phrases: ["Left in \\(.applicationName)", "New task in \\(.applicationName)"],\nshortTitle: "x"';
    expect(shortcutPhrases(source)).toEqual(['Left in ${applicationName}', 'New task in ${applicationName}']);
  });
});

const COPY_SOURCE = [
  'enum SampleCopy {',
  '    static var title: String { Localized.text("Connect an Agent") }',
  '    static func left(count: Int) -> String {',
  '        Localized.text("\\(count) left in \\(TaskLimits.titleMaxLength.formatted())")',
  '    }',
  '    static var caption: AttributedString { Localized.attributed("Run `/mcp` and \\"choose\\" todz") }',
  '}',
].join('\n');

const INTENT_SOURCE = [
  'static let title: LocalizedStringResource = "Add a Task"',
  'static let description = IntentDescription("Adds a task to the Inbox.")',
  '@Parameter(title: "Keep todz quiet", default: false) var isQuiet: Bool',
].join('\n');

describe('localizedKeys', () => {
  test('reads every literal a copy module resolves through Localized', () => {
    expect(localizedKeys(COPY_SOURCE)).toEqual([
      'Connect an Agent',
      '\\(count) left in \\(TaskLimits.titleMaxLength.formatted())',
      'Run `/mcp` and \\"choose\\" todz',
    ]);
  });

  test('reads the literals an App Intent hands to the system', () => {
    expect(localizedKeys(INTENT_SOURCE)).toEqual(['Add a Task', 'Adds a task to the Inbox.', 'Keep todz quiet']);
  });
});

describe('catalogKeyShape', () => {
  test('a Swift interpolation and a catalog placeholder have the same shape', () => {
    expect(catalogKeyShape('\\(count) left in \\(TaskLimits.titleMaxLength.formatted())')).toBe('% left in %');
    expect(catalogKeyShape('%lld left in %@')).toBe('% left in %');
    expect(catalogKeyShape('Switch to %1$@ and %2$lld')).toBe('Switch to % and %');
  });

  test('an escaped quote is the quote itself', () => {
    expect(catalogKeyShape('Type \\"\\(name)\\" to confirm.')).toBe('Type "%" to confirm.');
  });
});
