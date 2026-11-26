import Foundation
import Testing
@testable import TodzKit

private let controlOnly: ChordModifiers = [.control]
private let controlCommand: ChordModifiers = [.control, .command]
private let bareKey = KeyChord(keyCode: 0, key: "a", modifiers: [])

@Suite struct WorkspaceBindingsTests {
    @Test func controlAndTheDigitIsTheDefaultOfEachNumber() throws {
        let bindings = WorkspaceBindings()
        let first = try #require(bindings.chord(for: .number(1)))
        let ninth = try #require(bindings.chord(for: .number(9)))
        #expect(first.modifiers == controlOnly)
        #expect(first.label == "⌃1")
        #expect(ninth.label == "⌃9")
    }

    @Test func everyNumberHasADistinctDefaultKeyCode() {
        let codes = WorkspaceShortcuts.numbers.compactMap { WorkspaceBindings().chord(for: .number($0))?.keyCode }
        #expect(Set(codes).count == WorkspaceShortcuts.numbers.count)
    }

    @Test func controlCommandBracketsAreThePreviousAndNextDefaults() throws {
        let bindings = WorkspaceBindings()
        let previous = try #require(bindings.chord(for: .previous))
        let next = try #require(bindings.chord(for: .next))
        #expect(previous.modifiers == controlCommand)
        #expect(previous.label == "⌃⌘[")
        #expect(next.label == "⌃⌘]")
    }

    @Test func aNumberBeyondTheNinthHasNoChord() {
        #expect(WorkspaceBindings().chord(for: .number(10)) == nil)
    }

    @Test func everyActionHasADistinctDefaultChord() {
        #expect(WorkspaceAction.all.count == 11)
        #expect(Set(WorkspaceAction.all.compactMap { WorkspaceBindings().chord(for: $0) }).count == 11)
    }

    @Test func theListChordsAreCommandAndTheWorkspaceChordsNeverUseCommandWithADigit() {
        #expect(WorkspaceShortcuts.listModifiers == [.command])
        let numberChords = WorkspaceShortcuts.numbers.compactMap { WorkspaceBindings().chord(for: .number($0)) }
        #expect(numberChords.allSatisfy { $0.modifiers == [.control] })
        #expect(numberChords.allSatisfy { $0.modifiers != WorkspaceShortcuts.listModifiers })
    }

    @Test func aChordNamesItsAction() throws {
        let bindings = WorkspaceBindings()
        let chord = try #require(bindings.chord(for: .number(3)))
        #expect(bindings.action(for: chord) == .number(3))
    }

    @Test func aRebindReplacesTheChordOfThatActionOnly() throws {
        let chord = KeyChord(keyCode: 0, key: "a", modifiers: controlOnly)
        let rebound = try WorkspaceBindings().rebinding(.next, to: chord).get()
        #expect(rebound.chord(for: .next) == chord)
        #expect(rebound.chord(for: .previous) == WorkspaceBindings().chord(for: .previous))
        #expect(rebound.action(for: chord) == .next)
    }

    @Test func aChordAnotherActionHoldsIsRefused() throws {
        let bindings = WorkspaceBindings()
        let held = try #require(bindings.chord(for: .number(2)))
        #expect(bindings.rebinding(.number(1), to: held) == .failure(.taken(by: .number(2))))
    }

    @Test func rebindingToTheChordItAlreadyHoldsIsAccepted() throws {
        let bindings = WorkspaceBindings()
        let held = try #require(bindings.chord(for: .number(2)))
        #expect(bindings.rebinding(.number(2), to: held) == .success(bindings))
    }

    @Test func aChordWithoutAControlOptionOrCommandIsRefused() {
        #expect(WorkspaceBindings().rebinding(.next, to: bareKey) == .failure(.needsModifier))
    }

    @Test func aStorageNameReadsBackToItsAction() {
        #expect(WorkspaceAction.all.compactMap { WorkspaceAction(storageName: $0.storageName) } == WorkspaceAction.all)
        #expect(WorkspaceAction(storageName: "number10") == nil)
        #expect(WorkspaceAction(storageName: "sideways") == nil)
    }
}

@Suite struct WorkspaceShortcutsPreferenceTests {
    @Test func aFreshDomainReadsTheDefaultBindings() throws {
        let domain = try EmptyDomain()
        #expect(WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).bindings == WorkspaceBindings())
    }

    @Test func aFreshDomainReadsTheGlobalSwitchOn() throws {
        let domain = try EmptyDomain()
        #expect(WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).isGlobalOn)
    }

    @Test func aStoredOffReadsOff() throws {
        let domain = try EmptyDomain()
        domain.defaults.set(false, forKey: WorkspaceShortcutsPreference.isGlobalOnStorageKey)
        #expect(!WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).isGlobalOn)
    }

    @Test func registeringTheDefaultsRegistersOn() throws {
        let domain = try EmptyDomain()
        WorkspaceShortcutsPreference.registerDefaults(in: domain.defaults)
        #expect(domain.defaults.object(forKey: WorkspaceShortcutsPreference.isGlobalOnStorageKey) as? Bool == true)
    }

    @Test func aRebindIsPersistedAndReloaded() throws {
        let domain = try EmptyDomain()
        let preference = WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name)
        let chord = KeyChord(keyCode: 0, key: "a", modifiers: controlOnly)
        preference.store(try WorkspaceBindings().rebinding(.next, to: chord).get())
        let reloaded = WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).bindings
        #expect(reloaded.chord(for: .next) == chord)
        #expect(reloaded.chord(for: .number(1)) == WorkspaceBindings().chord(for: .number(1)))
    }

    @Test func unreadableStoredBindingsReadAsTheDefaults() throws {
        let domain = try EmptyDomain()
        domain.defaults.set(Data("not json".utf8), forKey: WorkspaceShortcutsPreference.bindingsStorageKey)
        #expect(WorkspaceShortcutsPreference(defaults: domain.defaults, domainName: domain.name).bindings == WorkspaceBindings())
    }
}
