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
        #expect(!harness.lock.requiresAuthentication(for: .switchWorkspaces))
        #expect(harness.lock.visible([acme, side], current: "acme") == [acme, side])
    }

    @Test func aFreshLaunchWithTheSwitchOnIsLocked() throws {
        let harness = try LockHarness(isOn: true)
        #expect(harness.lock.isEnabled)
        #expect(harness.lock.isLocked)
        #expect(!harness.lock.isUnlocked)
    }

    @Test func onlyTheCurrentWorkspaceIsVisibleWhileLocked() throws {
        let harness = try LockHarness(isOn: true)
        #expect(harness.lock.visible([acme, side, garden], current: "acme") == [acme])
    }

    @Test func withNoCurrentWorkspaceNothingIsVisible() throws {
        let harness = try LockHarness(isOn: true)
        #expect(harness.lock.visible([acme, side], current: nil).isEmpty)
    }

    @Test func switchingWorkspacesNeedsAuthenticationWhileLocked() throws {
        let harness = try LockHarness(isOn: true)
        #expect(harness.lock.requiresAuthentication(for: .switchWorkspaces))
    }

    @Test func switchingWorkspacesNeedsNoAuthenticationWithTheLockOffOrInAnUnlockedSession() async throws {
        let off = try LockHarness()
        #expect(!off.lock.requiresAuthentication(for: .switchWorkspaces))
        let unlocked = try LockHarness(isOn: true)
        _ = await unlocked.lock.authorize(.switchWorkspaces)
        #expect(!unlocked.lock.requiresAuthentication(for: .switchWorkspaces))
        #expect(unlocked.authenticator.asked == [.switchWorkspaces])
    }

    @Test func creatingRemovingTurningOffAndChangingTheTimeoutNeedAuthenticationWhileLocked() throws {
        let harness = try LockHarness(isOn: true)
        let actions: [WorkspaceLockAction] = [.createWorkspace, .removeWorkspace, .turnOff, .changeTimeout]
        #expect(actions.allSatisfy { harness.lock.requiresAuthentication(for: $0) })
    }

    @Test func authenticatingUnlocksTheSession() async throws {
        let harness = try LockHarness(isOn: true)
        let isAuthorized = await harness.lock.authorize(.switchWorkspaces)
        #expect(isAuthorized)
        #expect(harness.lock.isUnlocked)
        #expect(harness.authenticator.asked == [.switchWorkspaces])
        #expect(harness.lock.visible([acme, side], current: "acme") == [acme, side])
    }

    @Test func anUnlockedSessionAsksNoMore() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.authorize(.changeTimeout)
        let isAuthorized = await harness.lock.authorize(.switchWorkspaces)
        #expect(isAuthorized)
        #expect(harness.authenticator.asked.count == 1)
    }

    @Test func aRefusedAuthenticationStaysLocked() async throws {
        let harness = try LockHarness(isOn: true)
        harness.authenticator.isOwnerAuthenticated = false
        let isAuthorized = await harness.lock.authorize(.switchWorkspaces)
        #expect(!isAuthorized)
        #expect(harness.lock.isLocked)
    }

    @Test func aCancelledPromptIsSilentAndAFailedOneIsFlaggedUntilTheNextTry() async throws {
        let harness = try LockHarness(isOn: true)
        harness.authenticator.isOwnerAuthenticated = false
        harness.authenticator.isCancelling = true
        #expect(!(await harness.lock.authorize(.changeTimeout)))
        #expect(!harness.lock.isConfirmationFailed)
        harness.authenticator.isCancelling = false
        #expect(!(await harness.lock.authorize(.changeTimeout)))
        #expect(harness.lock.isConfirmationFailed)
        harness.authenticator.isOwnerAuthenticated = true
        #expect(await harness.lock.authorize(.changeTimeout))
        #expect(!harness.lock.isConfirmationFailed)
    }

    @Test func anyOtherUnavailabilityKeepsItLockedEvenForTurningOffAndFlagsTheFailure() async throws {
        let harness = try LockHarness(isOn: true)
        harness.authenticator.availability = .unavailable
        #expect(!(await harness.lock.turnOff()))
        #expect(harness.lock.isEnabled)
        #expect(harness.lock.isConfirmationFailed)
        #expect(!(await harness.lock.authorize(.switchWorkspaces)))
        #expect(harness.authenticator.asked.isEmpty)
    }

    @Test func aMacWithNoPasswordRefusesEverythingButTurningTheSwitchOff() async throws {
        let harness = try LockHarness(isOn: true)
        harness.authenticator.availability = .passcodeNotSet
        #expect(harness.lock.availability == .passcodeNotSet)
        #expect(!(await harness.lock.authorize(.switchWorkspaces)))
        #expect(!(await harness.lock.set(timeout: .oneHour)))
        #expect(harness.authenticator.asked.isEmpty)
        #expect(await harness.lock.turnOff())
        #expect(!harness.lock.isEnabled)
    }

    @Test func anActionThatNeedsNoAuthenticationNeverAsks() async throws {
        let harness = try LockHarness()
        let isAuthorized = await harness.lock.authorize(.createWorkspace)
        #expect(isAuthorized)
        #expect(harness.authenticator.asked.isEmpty)
    }

    @Test func twoActionsAskingTogetherShareOnePrompt() async throws {
        let harness = try LockHarness(isOn: true)
        harness.authenticator.isHolding = true
        let first = Task { await harness.lock.authorize(.switchWorkspaces) }
        let second = Task { await harness.lock.authorize(.switchWorkspaces) }
        await Task.yield()
        await Task.yield()
        harness.authenticator.release()
        #expect(await first.value)
        #expect(await second.value)
        #expect(harness.authenticator.asked.count == 1)
    }

    @Test(arguments: RelockTrigger.allCases) func everyTriggerLocksAnUnlockedSession(trigger: RelockTrigger) async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.authorize(.changeTimeout)
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
        #expect(!(await harness.lock.turnOff()))
        #expect(harness.lock.isEnabled)
        harness.authenticator.isOwnerAuthenticated = true
        #expect(await harness.lock.turnOff())
        #expect(!harness.lock.isEnabled)
        #expect(!harness.preference.isOn)
        #expect(!harness.lock.isLocked)
    }

    @Test func turningTheSwitchBackOnStartsLocked() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.turnOff()
        harness.lock.turnOn()
        #expect(harness.lock.isLocked)
    }

    @Test func changingTheTimeoutNeedsAuthenticationAndIsStored() async throws {
        let harness = try LockHarness(isOn: true)
        harness.authenticator.isOwnerAuthenticated = false
        #expect(!(await harness.lock.set(timeout: .oneHour)))
        #expect(harness.lock.timeout == .fiveMinutes)
        harness.authenticator.isOwnerAuthenticated = true
        #expect(await harness.lock.set(timeout: .oneHour))
        #expect(harness.lock.timeout == .oneHour)
        #expect(harness.preference.timeout == .oneHour)
    }

    @Test func changingTheTimeoutWithTheSwitchOffNeedsNoAuthentication() async throws {
        let harness = try LockHarness()
        #expect(await harness.lock.set(timeout: .oneMinute))
        #expect(harness.authenticator.asked.isEmpty)
    }

    @Test func idleBeyondTheTimeoutRelocksAnUnlockedSession() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.authorize(.changeTimeout)
        harness.clock.now = harness.clock.now.addingTimeInterval(WorkspaceLockTimeout.fiveMinutes.seconds - 1)
        #expect(!harness.lock.relockIfIdle())
        harness.clock.now = harness.clock.now.addingTimeInterval(1)
        #expect(harness.lock.relockIfIdle())
        #expect(harness.lock.isLocked)
    }

    @Test func inputRestartsTheIdleClock() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.authorize(.changeTimeout)
        harness.clock.now = harness.clock.now.addingTimeInterval(WorkspaceLockTimeout.fiveMinutes.seconds - 1)
        harness.lock.noteInput()
        harness.clock.now = harness.clock.now.addingTimeInterval(WorkspaceLockTimeout.fiveMinutes.seconds - 1)
        #expect(!harness.lock.relockIfIdle())
    }

    @Test func theChosenTimeoutSetsTheIdleLimit() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.set(timeout: .oneMinute)
        _ = await harness.lock.authorize(.changeTimeout)
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
        _ = await harness.lock.authorize(.changeTimeout)
        _ = harness.lock.relock(because: .screensaverStarted)
        #expect(harness.lock.requiresAuthentication(for: .switchWorkspaces))
    }

    @Test func collapsingKeepsOnlyTheCurrentWorkspaceWhileLocked() throws {
        let harness = try LockHarness(isOn: true)
        let all = [acme, side, garden]
        #expect(harness.lock.visible(WorkspaceSelection.all.workspaces(in: all), current: "side") == [side])
        #expect(harness.lock.visible(WorkspaceSelection.chosen(["acme", "garden"]).workspaces(in: all), current: "garden") == [garden])
    }

    @Test func collapsingShowsNothingWhenTheCurrentIsNotThere() throws {
        let harness = try LockHarness(isOn: true)
        #expect(harness.lock.visible([side, garden], current: "acme").isEmpty)
        #expect(harness.lock.visible([side, garden], current: nil).isEmpty)
    }

    @Test func turningOffAndChangingTheTimeoutAskEvenInAnUnlockedSession() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.authorize(.switchWorkspaces)
        #expect(harness.lock.isUnlocked)
        #expect(harness.lock.requiresAuthentication(for: .turnOff))
        #expect(harness.lock.requiresAuthentication(for: .changeTimeout))
        harness.authenticator.isOwnerAuthenticated = false
        #expect(!(await harness.lock.turnOff()))
        #expect(!(await harness.lock.set(timeout: .oneHour)))
        #expect(harness.lock.isEnabled)
        #expect(harness.lock.timeout == .fiveMinutes)
    }

    @Test func anotherActionWhileAPromptIsOpenIsRefusedNotSharedAndTheSameActionIsShared() async throws {
        let harness = try LockHarness(isOn: true)
        harness.authenticator.isHolding = true
        let first = Task { await harness.lock.authorize(.turnOff) }
        await Task.yield()
        await Task.yield()
        let other = await harness.lock.authorize(.changeTimeout)
        let same = Task { await harness.lock.authorize(.turnOff) }
        await Task.yield()
        harness.authenticator.release()
        #expect(!other)
        #expect(await first.value)
        #expect(await same.value)
        #expect(harness.authenticator.asked == [.turnOff])
    }

    @Test func inputArrivingAfterTheTimeoutLeavesTheSessionLocked() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.authorize(.switchWorkspaces)
        harness.clock.now = harness.clock.now.addingTimeInterval(WorkspaceLockTimeout.fiveMinutes.seconds)
        #expect(harness.lock.noteInput())
        #expect(harness.lock.isLocked)
        #expect(harness.lock.lastRelockTrigger == .idle)
        #expect(!harness.lock.noteInput())
        #expect(harness.lock.isLocked)
    }

    @Test func widgetsSeeOnlyTheCurrentWorkspaceWheneverTheSwitchIsOn() async throws {
        let harness = try LockHarness(isOn: true)
        _ = await harness.lock.authorize(.switchWorkspaces)
        #expect(harness.lock.visibleToWidgets([acme, side], current: "acme") == [acme])
        #expect(harness.lock.visibleToWidgets([side], current: "acme").isEmpty)
        let off = try LockHarness()
        #expect(off.lock.visibleToWidgets([acme, side], current: "acme") == [acme, side])
    }

    @Test func collapsingChangesNothingWhileUnlockedOrOff() async throws {
        let off = try LockHarness()
        #expect(off.lock.visible([acme, side], current: "acme") == [acme, side])
        let unlocked = try LockHarness(isOn: true)
        _ = await unlocked.lock.authorize(.changeTimeout)
        #expect(unlocked.lock.visible([acme, side], current: "acme") == [acme, side])
    }
}
