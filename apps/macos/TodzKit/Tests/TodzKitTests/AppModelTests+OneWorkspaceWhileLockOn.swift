import Foundation
import Testing
@testable import TodzKit

extension AppModelTests {
    @MainActor private func unlockedHarness(selection: WorkspaceSelection? = nil) async throws -> AppModelHarness {
        let harness = try await singleWorkspaceHarness(selection: selection)
        #expect(await harness.model.beginWorkspaceSwitch())
        return harness
    }

    @Test func anUnlockedSessionWithTheSwitchOnRefusesAllWorkspaces() async throws {
        let harness = try await unlockedHarness()
        await harness.model.selectWorkspaces(.all)
        #expect(harness.model.selection == .chosen(["acme"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
        #expect(harness.authenticator.asked == [.switchWorkspaces])
    }

    @Test func anUnlockedSessionWithTheSwitchOnRefusesSeveralWorkspaces() async throws {
        let harness = try await unlockedHarness()
        await harness.model.selectWorkspaces(.chosen(["acme", "secret"]))
        #expect(harness.model.selection == .chosen(["acme"]))
        await harness.model.toggleWorkspace(identifier: "secret")
        #expect(harness.model.selection == .chosen(["acme"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
    }

    @Test func anUnlockedSessionWithTheSwitchOnStillSwitchesToOneOtherWorkspaceWithoutAsking() async throws {
        let harness = try await unlockedHarness()
        await harness.model.switchWorkspace(identifier: "secret")
        #expect(harness.model.selection == .chosen(["secret"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["secret"])
        #expect(harness.authenticator.asked == [.switchWorkspaces])
    }

    @Test func unlockingACollapsedLaunchThatRememberedAllLeavesOneWorkspace() async throws {
        let harness = try await unlockedHarness(selection: .all)
        #expect(harness.model.selection == .chosen(["acme"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
    }

    @Test func thePickerRefusesAllWorkspacesAfterTheSwitchPrompt() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "secret")
        harness.vault.secret = harness.session
        await harness.model.launch()
        #expect(await harness.model.beginWorkspaceSwitch())
        await harness.model.chooseWorkspaces(.all)
        #expect(harness.model.phase == .choosing)
        await harness.model.chooseWorkspace(identifier: "acme")
        #expect(harness.model.phase == .ready)
        #expect(harness.model.selection == .chosen(["acme"]))
    }

    @Test func turningTheSwitchOffBringsSeveralBackButNeverTheOldSelection() async throws {
        let harness = try await unlockedHarness(selection: .all)
        #expect(await harness.model.turnWorkspaceLockOff())
        #expect(harness.model.selection == .chosen(["acme"]))
        await harness.model.selectWorkspaces(.all)
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme", "secret"])
    }

    @Test func pinTurningTheSwitchOnWhileASwitchPromptIsOpenNeverLeavesTwoWorkspaces() async throws {
        let harness = try await singleWorkspaceHarness(isLockOn: false, selection: .all)
        await harness.model.turnWorkspaceLockOn()
        harness.authenticator.isHolding = true
        let opening = Task { await harness.model.switchWorkspace(identifier: "secret") }
        await Task.yield()
        await Task.yield()
        await harness.model.turnWorkspaceLockOn()
        harness.authenticator.release()
        await opening.value
        #expect(harness.model.selection == .chosen(["secret"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["secret"])
        #expect(harness.authenticator.asked == [.switchWorkspaces])
    }

    @Test func pinALockedLaunchThatRememberedAllOffersTheListAndEntersWithOneWorkspace() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        let acme = harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "secret")
        harness.store.owner = OwnerCache(ownerIdentifier: harness.ownerIdentifier, workspaces: [acme, side], activeWorkspaceIdentifier: nil, selection: .all)
        await harness.signedIn()
        #expect(harness.model.phase == .choosing)
        #expect(harness.model.visibleWorkspaces.isEmpty)
        #expect(await harness.model.beginWorkspaceSwitch())
        await harness.model.chooseWorkspaces(.all)
        #expect(harness.model.phase == .choosing)
        await harness.model.chooseWorkspace(identifier: "acme")
        #expect(harness.model.phase == .ready)
        #expect(harness.model.selection == .chosen(["acme"]))
        #expect(harness.model.shownWorkspaces.map(\.identifier) == ["acme"])
    }

    @Test func theNumberOfTheCurrentWorkspaceNeitherAsksNorMovesWhileLocked() async throws {
        let harness = try await singleWorkspaceHarness(active: "secret")
        await harness.model.switchWorkspace(number: 1)
        await harness.model.switchWorkspace(action: .number(1))
        #expect(harness.authenticator.asked.isEmpty)
        #expect(harness.model.activeWorkspace?.identifier == "secret")
        #expect(harness.model.workspaceLock.isLocked)
    }

    @Test func theNumberChordsBeyondTheListReachTheModelWhileLockedWithoutDrawingRows() async throws {
        let harness = try await singleWorkspaceHarness()
        let secondChord = try #require(WorkspaceAction.number(2).inAppChord)
        let firstChord = try #require(WorkspaceAction.number(1).inAppChord)
        #expect(harness.model.hiddenWorkspaceAction(for: firstChord) == nil)
        let action = try #require(harness.model.hiddenWorkspaceAction(for: secondChord))
        #expect(harness.model.visibleWorkspaces.map(\.identifier) == ["acme"])
        await harness.model.switchWorkspace(action: action)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        #expect(harness.model.activeWorkspace?.identifier == "secret")
        #expect(harness.model.hiddenWorkspaceAction(for: secondChord) == nil)
    }

    @Test func theCommandNumberChordsBeyondTheListReachTheModelWhileLocked() async throws {
        let harness = try await singleWorkspaceHarness()
        let control = try #require(WorkspaceAction.number(2).inAppChord)
        let command = KeyChord(keyCode: control.keyCode, key: control.key, modifiers: WorkspaceShortcuts.listModifiers)
        let firstControl = try #require(WorkspaceAction.number(1).inAppChord)
        let firstCommand = KeyChord(keyCode: firstControl.keyCode, key: firstControl.key, modifiers: WorkspaceShortcuts.listModifiers)
        #expect(harness.model.hiddenWorkspaceAction(for: firstCommand) == nil)
        let action = try #require(harness.model.hiddenWorkspaceAction(for: command))
        await harness.model.switchWorkspace(action: action)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        #expect(harness.model.activeWorkspace?.identifier == "secret")
    }

    @Test func noChordIsHiddenOnTheSignInScreen() async throws {
        let harness = try AppModelHarness(isWorkspaceLockOn: true)
        let secondChord = try #require(WorkspaceAction.number(2).inAppChord)
        #expect(harness.model.phase != .ready)
        #expect(harness.model.hiddenWorkspaceAction(for: secondChord) == nil)
    }

    @Test func noChordIsHiddenWithTheSwitchOff() async throws {
        let harness = try await singleWorkspaceHarness(isLockOn: false)
        let thirdChord = try #require(WorkspaceAction.number(3).inAppChord)
        #expect(harness.model.hiddenWorkspaceAction(for: thirdChord) == nil)
    }

    @Test func aNumberBeyondTheVisibleListAsksThenResolvesAgainstEveryWorkspace() async throws {
        let harness = try await singleWorkspaceHarness(active: "secret")
        await harness.model.switchWorkspace(number: 2)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        #expect(harness.model.activeWorkspace?.identifier == "secret")
        await harness.model.switchWorkspace(number: 1)
        #expect(harness.model.activeWorkspace?.identifier == "acme")
        #expect(harness.authenticator.asked == [.switchWorkspaces])
    }
}
