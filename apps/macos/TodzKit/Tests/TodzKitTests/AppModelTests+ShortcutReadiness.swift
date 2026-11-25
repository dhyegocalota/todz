import Observation
import Testing
@testable import TodzKit

@MainActor private final class ObservedChange {
    var isSeen = false
}

extension AppModelTests {
    @Test func theLaunchSettlingIsObserved() async throws {
        let harness = try AppModelHarness()
        let change = ObservedChange()
        withObservationTracking {
            _ = harness.model.isLaunchSettled
        } onChange: {
            MainActor.assumeIsolated { change.isSeen = true }
        }
        await harness.model.launch()
        #expect(harness.model.isLaunchSettled)
        #expect(change.isSeen)
    }

    @Test func aLaunchedLoadedModelIsReadyWithoutWaiting() async throws {
        let harness = try await todayHarness(openCount: 1)
        #expect(await harness.model.shortcutReadiness() == .ready)
        #expect(!harness.pause.durations.contains(ShortcutLimits.readinessWait))
    }

    @Test func anUnlaunchedModelWithACacheIsReadyWithThePulledTasksOnceThePullAnswers() async throws {
        let harness = try cachedHarness(cachedTitle: "Cached call", pulledTitle: "Pulled call")
        #expect(await harness.model.shortcutReadiness() == .ready)
        let today = try #require(harness.model.shortcutToday)
        #expect(!today.isOffline)
        #expect(today.tasks.map(\.title) == ["Pulled call"])
        #expect(harness.service.routes().contains(.listWorkspaces))
        #expect(harness.pause.heldCount == 0)
    }

    @Test func anUnlaunchedModelWithACacheAndThePullHeldAnswersTheCacheMarkedOfflineAfterTheWait() async throws {
        let harness = try cachedHarness(cachedTitle: "Cached call", pulledTitle: "Pulled call")
        harness.service.suspend(.readChanges)
        let asking = Task { await harness.model.shortcutReadiness() }
        await harness.service.held(.readChanges)
        await harness.pause.started()
        #expect(harness.pause.durations == [ShortcutLimits.readinessWait])
        harness.pause.release()
        #expect(await asking.value == .ready)
        let today = try #require(harness.model.shortcutToday)
        #expect(today.isOffline)
        #expect(today.tasks.map(\.title) == ["Cached call"])
        harness.service.resume(.readChanges)
        await harness.pulled(shortcutInboxIdentifier)
    }

    @Test func aModelWithNoSessionIsSignedOut() async throws {
        let harness = try AppModelHarness()
        #expect(await harness.model.shortcutReadiness() == .signedOut)
    }

    @Test func aSessionWithNoWorkspaceHasNoWorkspace() async throws {
        let harness = try AppModelHarness()
        harness.vault.secret = harness.session
        #expect(await harness.model.shortcutReadiness() == .noWorkspace)
    }

    @Test func aListingHeldPastTheWaitIsStillLoadingAndTheLaunchIsNotAwaited() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.vault.secret = harness.session
        harness.service.suspend(.listWorkspaces)
        let asking = Task { await harness.model.shortcutReadiness() }
        await harness.service.held(.listWorkspaces)
        await harness.pause.started(count: 1)
        #expect(harness.pause.durations == [ShortcutLimits.readinessWait])
        harness.pause.release()
        #expect(await asking.value == .loading)
        #expect(harness.model.phase == .loading)
        #expect(harness.service.routes().last == .listWorkspaces)
        harness.service.resume(.listWorkspaces)
    }

    @Test func aListingAnsweredBeforeTheWaitEndsIsReady() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.vault.secret = harness.session
        harness.service.suspend(.listWorkspaces)
        let asking = Task { await harness.model.shortcutReadiness() }
        await harness.service.held(.listWorkspaces)
        harness.service.resume(.listWorkspaces)
        #expect(await asking.value == .ready)
        #expect(harness.pause.heldCount == 0)
    }

    @Test func aSignOutWhileWaitingIsSignedOut() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.vault.secret = harness.session
        harness.service.suspend(.listWorkspaces)
        let asking = Task { await harness.model.shortcutReadiness() }
        await harness.service.held(.listWorkspaces)
        await harness.model.signOut()
        #expect(await asking.value == .signedOut)
        #expect(harness.pause.heldCount == 0)
        harness.service.resume(.listWorkspaces)
    }

    @Test func aColdAddWaitsForReadinessInsteadOfAnsweringSignedOut() async throws {
        let harness = try cachedHarness(cachedTitle: "Cached call", pulledTitle: "Pulled call")
        harness.service.suspend(.addTasks)
        #expect(await harness.model.shortcutReadiness() == .ready)
        let addition = await harness.model.addFromShortcut(title: "Book the dentist", isDueToday: true)
        #expect(addition == .added(title: "Book the dentist", destination: .today, workspaceName: "acme", isOffline: false))
        await harness.service.held(.addTasks)
        harness.service.resume(.addTasks)
        await harness.flushed()
    }

    @Test func aColdAddWithTheListingHeldIsLoadingAndNotNoWorkspace() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.vault.secret = harness.session
        harness.service.suspend(.listWorkspaces)
        let asking = Task { await harness.model.shortcutReadiness() }
        await harness.service.held(.listWorkspaces)
        await harness.pause.started(count: 1)
        harness.pause.release()
        #expect(await asking.value == .loading)
        harness.service.resume(.listWorkspaces)
    }
}
