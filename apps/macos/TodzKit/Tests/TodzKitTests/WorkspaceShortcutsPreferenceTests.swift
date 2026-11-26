import Foundation
import Testing
@testable import TodzKit

private let controlOption: ChordModifiers = [.control, .option]

@Suite struct WorkspaceShortcutsPreferenceTests {
    @Test func aFreshDomainReadsTheGlobalChordDefaults() throws {
        let domain = try EmptyDomain()
        #expect(WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).globalChords == GlobalWorkspaceChords())
    }

    @Test func aFreshDomainReadsTheGlobalSwitchOff() throws {
        let domain = try EmptyDomain()
        #expect(!WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).isGlobalOn)
    }

    @Test func aStoredOnReadsOn() throws {
        let domain = try EmptyDomain()
        domain.defaults.set(true, forKey: WorkspaceShortcutsPreference.isGlobalOnStorageKey)
        #expect(WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).isGlobalOn)
    }

    @Test func aStoredOffReadsOff() throws {
        let domain = try EmptyDomain()
        domain.defaults.set(false, forKey: WorkspaceShortcutsPreference.isGlobalOnStorageKey)
        #expect(!WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).isGlobalOn)
    }

    @Test func registeringTheDefaultsRegistersOff() throws {
        let domain = try EmptyDomain()
        WorkspaceShortcutsPreference.registerDefaults(in: domain.defaults)
        #expect(domain.defaults.object(forKey: WorkspaceShortcutsPreference.isGlobalOnStorageKey) as? Bool == false)
    }

    @Test func aRebindIsPersistedAndReloaded() throws {
        let domain = try EmptyDomain()
        let preference = WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name)
        let chord = KeyChord(keyCode: 0, key: "a", modifiers: controlOption)
        preference.store(try GlobalWorkspaceChords().rebinding(.number(2), to: chord).get())
        let reloaded = WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).globalChords
        #expect(reloaded.chord(for: .number(2)) == chord)
        #expect(reloaded.chord(for: .number(1)) == GlobalWorkspaceChords().chord(for: .number(1)))
    }

    @Test func aStoredValidOverrideIsRead() throws {
        let domain = try EmptyDomain()
        let chord = KeyChord(keyCode: 0, key: "a", modifiers: controlOption)
        let stored = try JSONEncoder().encode([WorkspaceAction.number(4).storageName: chord])
        domain.defaults.set(stored, forKey: WorkspaceShortcutsPreference.bindingsStorageKey)
        #expect(WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).globalChords.chord(for: .number(4)) == chord)
    }

    @Test func aStoredOneModifierOverrideFromBeforeIsDroppedToTheGlobalDefault() throws {
        let domain = try EmptyDomain()
        let oldInAppChord = KeyChord(keyCode: 18, key: "1", modifiers: [.control])
        let stored = try JSONEncoder().encode([WorkspaceAction.number(1).storageName: oldInAppChord])
        domain.defaults.set(stored, forKey: WorkspaceShortcutsPreference.bindingsStorageKey)
        let chords = WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).globalChords
        #expect(chords.chord(for: .number(1)) == GlobalWorkspaceChords().chord(for: .number(1)))
    }

    @Test func aStoredOverrideThatCollidesWithAnotherWorkspaceDefaultIsDropped() throws {
        let domain = try EmptyDomain()
        let collidingChord = try #require(WorkspaceAction.number(2).globalDefaultChord)
        let stored = try JSONEncoder().encode([WorkspaceAction.number(1).storageName: collidingChord])
        domain.defaults.set(stored, forKey: WorkspaceShortcutsPreference.bindingsStorageKey)
        let chords = WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).globalChords
        #expect(chords.chord(for: .number(1)) == WorkspaceAction.number(1).globalDefaultChord)
        #expect(chords.overrides.isEmpty)
    }

    @Test func aStoredOverrideForPreviousIsDropped() throws {
        let domain = try EmptyDomain()
        let chord = KeyChord(keyCode: 0, key: "a", modifiers: controlOption)
        let stored = try JSONEncoder().encode([WorkspaceAction.previous.storageName: chord])
        domain.defaults.set(stored, forKey: WorkspaceShortcutsPreference.bindingsStorageKey)
        #expect(WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).globalChords.chord(for: .previous) == nil)
    }

    @Test func unreadableStoredChordsReadAsTheDefaults() throws {
        let domain = try EmptyDomain()
        domain.defaults.set(Data("not json".utf8), forKey: WorkspaceShortcutsPreference.bindingsStorageKey)
        #expect(WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).globalChords == GlobalWorkspaceChords())
    }
}
