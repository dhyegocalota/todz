import Foundation
import Testing
@testable import TodzKit

private let acme = Workspace(identifier: "acme", name: "Acme", createdAt: fixedInstant, projects: [])
private let side = Workspace(identifier: "side", name: "Side", createdAt: fixedInstant, projects: [])
private let garden = Workspace(identifier: "garden", name: "Garden", createdAt: fixedInstant, projects: [])

@MainActor private struct LockHarness {
    let authenticator = FakeAuthenticator()
    let clock = HarnessClock()
    let preference: WorkspaceLockPreference
    let lock: WorkspaceLock

    init(isOn: Bool = false) throws {
        let domain = try EmptyDomain()
        preference = WorkspaceLockPreference(defaults: domain.defaults, domainName: domain.name)
        preference.store(isOn: isOn)
        let clock = clock
        lock = WorkspaceLock(preference: preference, authenticator: authenticator, now: { clock.now })
    }
}

@MainActor @Suite struct WorkspaceLockTests {
    @Test func theSwitchIsOffByDefaultAndNothingIsLocked() throws {
        let harness = try LockHarness()
        #expect(!harness.lock.isEnabled)
        #expect(!harness.lock.isLocked)
        #expect(!harness.lock.requiresAuthentication(for: .showWorkspaces(identifiers: ["side"]), current: "acme"))
        #expect(harness.lock.presented([acme, side], current: "acme") == [.visible(acme), .visible(side)])
    }

    @Test func aFreshLaunchWithTheSwitchOnIsLocked() throws {
        let harness = try LockHarness(isOn: true)
        #expect(harness.lock.isEnabled)
        #expect(harness.lock.isLocked)
        #expect(!harness.lock.isUnlocked)
    }

    @Test func onlyTheCurrentWorkspaceIsVisibleWhileLocked() throws {
        let harness = try LockHarness(isOn: true)
        #expect(harness.lock.presented([acme, side, garden], current: "acme") == [.visible(acme), .locked(identifier: "side"), .locked(identifier: "garden")])
    }

    @Test func withNoCurrentWorkspaceEveryWorkspaceIsLocked() throws {
        let harness = try LockHarness(isOn: true)
        #expect(harness.lock.presented([acme, side], current: nil) == [.locked(identifier: "acme"), .locked(identifier: "side")])
    }

    @Test func aLockedWorkspaceCarriesNoNameCountOrProject() throws {
        let harness = try LockHarness(isOn: true)
        let inbox = Project(identifier: "side-inbox", name: "Inbox", isInbox: true, createdAt: fixedInstant)
        let secret = Workspace(identifier: "side", name: "Secret plans", createdAt: fixedInstant, projects: [inbox])
        let presented = harness.lock.presented([acme, secret], current: "acme")
        #expect(!String(describing: presented[1]).contains("Secret plans"))
        #expect(!String(describing: presented[1]).contains("Inbox"))
    }

    @Test func switchingToAnotherWorkspaceNeedsAuthenticationWhileLocked() throws {
        let harness = try LockHarness(isOn: true)
        #expect(harness.lock.requiresAuthentication(for: .showWorkspaces(identifiers: ["side"]), current: "acme"))
        #expect(harness.lock.requiresAuthentication(for: .showWorkspaces(identifiers: ["acme", "side"]), current: "acme"))
        #expect(!harness.lock.requiresAuthentication(for: .showWorkspaces(identifiers: ["acme"]), current: "acme"))
    }

    @Test func choosingWithNoCurrentWorkspaceNeedsAuthentication() throws {
        let harness = try LockHarness(isOn: true)
        #expect(harness.lock.requiresAuthentication(for: .showWorkspaces(identifiers: ["acme"]), current: nil))
    }

    @Test func creatingRemovingTurningOffAndChangingTheTimeoutNeedAuthenticationWhileLocked() throws {
        let harness = try LockHarness(isOn: true)
        let actions: [WorkspaceLockAction] = [.createWorkspace, .removeWorkspace, .turnOff, .changeTimeout]
        #expect(actions.allSatisfy { harness.lock.requiresAuthentication(for: $0, current: "acme") })
    }

    @Test func authenticatingUnlocksTheSession() async throws {
        let harness = try LockHarness(isOn: true)
        let isAuthorized = await harness.lock.authorize(.showWorkspaces(identifiers: ["side"]), current: "acme")
        #expect(isAuthorized)
        #expect(harness.lock.isUnlocked)
        #expect(harness.authenticator.asked == [.showWorkspaces(identifiers: ["side"])])
        #expect(harness.lock.presented([acme, side], current: "acme") == [.visible(acme), .visible(side)])
    }

    @Test func anUnlockedSessionAsksNoMore() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.authorize(.changeTimeout, current: "acme")
        let isAuthorized = await harness.lock.authorize(.showWorkspaces(identifiers: ["side"]), current: "acme")
        #expect(isAuthorized)
        #expect(harness.authenticator.asked.count == 1)
    }

    @Test func aRefusedAuthenticationStaysLocked() async throws {
        let harness = try LockHarness(isOn: true)
        harness.authenticator.isOwnerAuthenticated = false
        let isAuthorized = await harness.lock.authorize(.showWorkspaces(identifiers: ["side"]), current: "acme")
        #expect(!isAuthorized)
        #expect(harness.lock.isLocked)
    }

    @Test func aCancelledPromptIsSilentAndAFailedOneIsFlaggedUntilTheNextTry() async throws {
        let harness = try LockHarness(isOn: true)
        harness.authenticator.isOwnerAuthenticated = false
        harness.authenticator.isCancelling = true
        #expect(!(await harness.lock.authorize(.changeTimeout, current: "acme")))
        #expect(!harness.lock.isConfirmationFailed)
        harness.authenticator.isCancelling = false
        #expect(!(await harness.lock.authorize(.changeTimeout, current: "acme")))
        #expect(harness.lock.isConfirmationFailed)
        harness.authenticator.isOwnerAuthenticated = true
        #expect(await harness.lock.authorize(.changeTimeout, current: "acme"))
        #expect(!harness.lock.isConfirmationFailed)
    }

    @Test func aMacThatCannotAuthenticateRefusesEverythingButTurningTheSwitchOff() async throws {
        let harness = try LockHarness(isOn: true)
        harness.authenticator.isAvailable = false
        #expect(!harness.lock.canAuthenticate)
        #expect(!(await harness.lock.authorize(.showWorkspaces(identifiers: ["side"]), current: "acme")))
        #expect(!(await harness.lock.set(timeout: .oneHour, current: "acme")))
        #expect(harness.authenticator.asked.isEmpty)
        #expect(await harness.lock.turnOff(current: "acme"))
        #expect(!harness.lock.isEnabled)
    }

    @Test func anActionThatNeedsNoAuthenticationNeverAsks() async throws {
        let harness = try LockHarness(isOn: true)
        let isAuthorized = await harness.lock.authorize(.showWorkspaces(identifiers: ["acme"]), current: "acme")
        #expect(isAuthorized)
        #expect(harness.authenticator.asked.isEmpty)
        #expect(harness.lock.isLocked)
    }

    @Test func twoActionsAskingTogetherShareOnePrompt() async throws {
        let harness = try LockHarness(isOn: true)
        harness.authenticator.isHolding = true
        let first = Task { await harness.lock.authorize(.showWorkspaces(identifiers: ["side"]), current: "acme") }
        let second = Task { await harness.lock.authorize(.showWorkspaces(identifiers: ["garden"]), current: "acme") }
        await Task.yield()
        await Task.yield()
        harness.authenticator.release()
        #expect(await first.value)
        #expect(await second.value)
        #expect(harness.authenticator.asked.count == 1)
    }

    @Test(arguments: RelockTrigger.allCases) func everyTriggerLocksAnUnlockedSession(trigger: RelockTrigger) async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.authorize(.changeTimeout, current: "acme")
        #expect(harness.lock.relock(because: trigger))
        #expect(harness.lock.isLocked)
        #expect(harness.lock.lastRelockTrigger == trigger)
    }

    @Test func relockingALockedSessionChangesNothing() throws {
        let harness = try LockHarness(isOn: true)
        #expect(!harness.lock.relock(because: .systemSleep))
    }

    @Test func relockingWithTheSwitchOffChangesNothing() throws {
        let harness = try LockHarness()
        #expect(!harness.lock.relock(because: .screenLocked))
        #expect(!harness.lock.isLocked)
    }

    @Test func turningTheSwitchOnLocksAtOnceWithoutAuthentication() throws {
        let harness = try LockHarness()
        harness.lock.turnOn()
        #expect(harness.lock.isLocked)
        #expect(harness.preference.isOn)
        #expect(harness.authenticator.asked.isEmpty)
    }

    @Test func turningTheSwitchOffNeedsAuthenticationAndForgetsTheLock() async throws {
        let harness = try LockHarness(isOn: true)
        harness.authenticator.isOwnerAuthenticated = false
        #expect(!(await harness.lock.turnOff(current: "acme")))
        #expect(harness.lock.isEnabled)
        harness.authenticator.isOwnerAuthenticated = true
        #expect(await harness.lock.turnOff(current: "acme"))
        #expect(!harness.lock.isEnabled)
        #expect(!harness.preference.isOn)
        #expect(!harness.lock.isLocked)
    }

    @Test func turningTheSwitchBackOnStartsLocked() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.turnOff(current: "acme")
        harness.lock.turnOn()
        #expect(harness.lock.isLocked)
    }

    @Test func changingTheTimeoutNeedsAuthenticationAndIsStored() async throws {
        let harness = try LockHarness(isOn: true)
        harness.authenticator.isOwnerAuthenticated = false
        #expect(!(await harness.lock.set(timeout: .oneHour, current: "acme")))
        #expect(harness.lock.timeout == .fiveMinutes)
        harness.authenticator.isOwnerAuthenticated = true
        #expect(await harness.lock.set(timeout: .oneHour, current: "acme"))
        #expect(harness.lock.timeout == .oneHour)
        #expect(harness.preference.timeout == .oneHour)
    }

    @Test func changingTheTimeoutWithTheSwitchOffNeedsNoAuthentication() async throws {
        let harness = try LockHarness()
        #expect(await harness.lock.set(timeout: .oneMinute, current: nil))
        #expect(harness.authenticator.asked.isEmpty)
    }

    @Test func idleBeyondTheTimeoutRelocksAnUnlockedSession() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.authorize(.changeTimeout, current: "acme")
        harness.clock.now = harness.clock.now.addingTimeInterval(WorkspaceLockTimeout.fiveMinutes.seconds - 1)
        #expect(!harness.lock.relockIfIdle())
        harness.clock.now = harness.clock.now.addingTimeInterval(1)
        #expect(harness.lock.relockIfIdle())
        #expect(harness.lock.isLocked)
    }

    @Test func inputRestartsTheIdleClock() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.authorize(.changeTimeout, current: "acme")
        harness.clock.now = harness.clock.now.addingTimeInterval(WorkspaceLockTimeout.fiveMinutes.seconds - 1)
        harness.lock.noteInput()
        harness.clock.now = harness.clock.now.addingTimeInterval(WorkspaceLockTimeout.fiveMinutes.seconds - 1)
        #expect(!harness.lock.relockIfIdle())
    }

    @Test func theChosenTimeoutSetsTheIdleLimit() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.set(timeout: .oneMinute, current: "acme")
        _ = await harness.lock.authorize(.changeTimeout, current: "acme")
        harness.clock.now = harness.clock.now.addingTimeInterval(WorkspaceLockTimeout.oneMinute.seconds)
        #expect(harness.lock.relockIfIdle())
    }

    @Test func aNeverUnlockedSessionNeverRelocksFromIdle() throws {
        let harness = try LockHarness(isOn: true)
        harness.clock.now = harness.clock.now.addingTimeInterval(WorkspaceLockTimeout.oneHour.seconds)
        #expect(!harness.lock.relockIfIdle())
    }

    @Test func aRelockedSessionAsksAgain() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.authorize(.changeTimeout, current: "acme")
        _ = harness.lock.relock(because: .screensaverStarted)
        #expect(harness.lock.requiresAuthentication(for: .showWorkspaces(identifiers: ["side"]), current: "acme"))
    }

    @Test func collapsingKeepsOnlyTheCurrentWorkspaceWhileLocked() throws {
        let harness = try LockHarness(isOn: true)
        let all = [acme, side, garden]
        #expect(harness.lock.visible(WorkspaceSelection.all.workspaces(in: all), current: "side") == [side])
        #expect(harness.lock.visible(WorkspaceSelection.chosen(["acme", "garden"]).workspaces(in: all), current: "garden") == [garden])
    }

    @Test func collapsingKeepsTheFirstWorkspaceWhenTheCurrentIsNotSelected() throws {
        let harness = try LockHarness(isOn: true)
        #expect(harness.lock.visible([side, garden], current: "acme") == [side])
    }

    @Test func collapsingChangesNothingWhileUnlockedOrOff() async throws {
        let off = try LockHarness()
        #expect(off.lock.visible([acme, side], current: "acme") == [acme, side])
        let unlocked = try LockHarness(isOn: true)
        _ = await unlocked.lock.authorize(.changeTimeout, current: "acme")
        #expect(unlocked.lock.visible([acme, side], current: "acme") == [acme, side])
    }
}
