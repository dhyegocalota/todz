import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let launchIdentifier = "acme-launch"
private let gardenIdentifier = "acme-Garden"
private let nextWeek = CalendarDate(year: 2026, month: 12, day: 1)

extension AppModelTests {
    @MainActor private func watchHarness() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        harness.seedWorkspace(name: "side")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        harness.seedTasks(projectIdentifier: launchIdentifier, count: 1)
        await harness.signedIn()
        return harness
    }

    @MainActor func withoutLaunch(_ harness: AppModelHarness) {
        harness.service.workspaces = harness.service.workspaces.map { workspace in
            let kept = workspace.projects.filter { $0.identifier != launchIdentifier }
            return Workspace(identifier: workspace.identifier, name: workspace.name, createdAt: workspace.createdAt, projects: kept)
        }
    }

    @Test func theWatchesFollowTheActiveWorkspacesProjects() async throws {
        let harness = try await watchHarness()
        #expect(harness.signals.opens == [harness.watchKey(inboxIdentifier), harness.watchKey(launchIdentifier)])
        await harness.model.createProject(name: "Garden")
        #expect(harness.signals.opens.last == harness.watchKey(gardenIdentifier))
        withoutLaunch(harness)
        harness.service.workspaces = harness.service.workspaces.map { workspace in
            guard workspace.identifier == "acme" else { return workspace }
            let garden = Project(identifier: gardenIdentifier, name: "Garden", isInbox: false, createdAt: fixedInstant)
            return Workspace(identifier: workspace.identifier, name: workspace.name, createdAt: workspace.createdAt, projects: workspace.projects + [garden])
        }
        harness.service.failures[.renameProject] = .notFound
        await harness.model.renameProject(projectIdentifier: inboxIdentifier, name: "Mine")
        await harness.signals.cancelled(harness.watchKey(launchIdentifier))
        #expect(harness.signals.openCount(of: harness.watchKey(inboxIdentifier)) == 1)
        #expect(harness.signals.openCount(of: harness.watchKey(gardenIdentifier)) == 1)
        await harness.model.switchWorkspace(identifier: "side")
        await harness.signals.cancelled(harness.watchKey(inboxIdentifier))
        await harness.signals.cancelled(harness.watchKey(gardenIdentifier))
        #expect(harness.signals.opens.last == harness.watchKey("side-inbox"))
    }

    @Test func aProjectThatLeavesTheWorkspaceDropsItsWaitingChangesAsRefused() async throws {
        let harness = try await watchHarness()
        harness.service.failures[.updateTask] = .unreachable
        await harness.model.updateDueDate(task: TaskKey(projectIdentifier: launchIdentifier, number: 1), dueDate: nextWeek)
        await harness.pause.started()
        withoutLaunch(harness)
        harness.service.suspend(.listWorkspaces)
        harness.signals.fail(harness.watchKey(launchIdentifier), with: .notFound)
        await harness.service.held(.listWorkspaces)
        harness.service.resume(.listWorkspaces)
        await harness.model.workspaceReload?.value
        #expect(harness.model.waitingChangeCount == 0)
        #expect(try harness.store.storedOutbox() == Outbox())
        #expect(harness.model.banner == .changesRefused(count: 1))
        #expect(harness.model.activeWorkspace?.projects.map(\.identifier) == [inboxIdentifier])
    }

    @Test func aChangedSignalPullsThatProjectFromItsCursor() async throws {
        let harness = try await watchHarness()
        harness.service.suspend(.readChanges)
        harness.signals.send(.changed, to: harness.watchKey(inboxIdentifier))
        await harness.service.held(.readChanges)
        #expect(harness.service.calls == [.readChanges(session: harness.session, projectIdentifier: inboxIdentifier, cursor: 2)])
        harness.service.unsuspend(.readChanges)
        harness.service.resume(.readChanges)
    }

    @Test func aWatchReopensAfterGrowingDelaysAndAnOpenedResetsThemAndPulls() async throws {
        let harness = try await watchHarness()
        let inbox = harness.watchKey(inboxIdentifier)
        harness.signals.fail(inbox, with: .unreachable)
        await harness.pause.started()
        harness.pause.release()
        await harness.signals.opened(inbox, count: 2)
        harness.signals.fail(inbox, with: .unreachable)
        await harness.pause.started(count: 2)
        harness.pause.release()
        await harness.signals.opened(inbox, count: 3)
        harness.signals.fail(inbox, with: .unreachable)
        await harness.pause.started(count: 3)
        harness.pause.release()
        await harness.signals.opened(inbox, count: 4)
        harness.service.suspend(.readChanges)
        harness.signals.send(.opened, to: inbox)
        await harness.service.held(.readChanges)
        #expect(harness.service.calls.last == .readChanges(session: harness.session, projectIdentifier: inboxIdentifier, cursor: 2))
        harness.service.unsuspend(.readChanges)
        harness.service.resume(.readChanges)
        harness.signals.fail(inbox, with: .unreachable)
        await harness.pause.started(count: 4)
        #expect(harness.pause.durations == [.seconds(1), .seconds(2), .seconds(4), .seconds(1)])
    }

    @Test func twoProjectsGoneAskForOneWorkspaceReload() async throws {
        let harness = try await watchHarness()
        harness.service.suspend(.listWorkspaces)
        harness.signals.fail(harness.watchKey(inboxIdentifier), with: .notFound)
        harness.signals.fail(harness.watchKey(launchIdentifier), with: .notFound)
        await harness.pause.started(count: 2)
        await harness.service.held(.listWorkspaces)
        #expect(harness.service.routes().filter { $0 == .listWorkspaces }.count == 1)
        harness.service.resume(.listWorkspaces)
        await harness.model.workspaceReload?.value
    }

    @Test func aCancelledReloadThatFinishesLeavesTheNewerReloadsHandle() async throws {
        let harness = try await watchHarness()
        harness.service.suspend(.listWorkspaces)
        harness.model.requestWorkspaceReload()
        let cancelled = try #require(harness.model.workspaceReload)
        harness.model.stopWatching()
        harness.model.requestWorkspaceReload()
        await harness.service.held(.listWorkspaces, count: 2)
        harness.service.resume(.listWorkspaces)
        await cancelled.value
        #expect(harness.model.workspaceReload != nil)
        harness.service.unsuspend(.listWorkspaces)
        harness.service.resume(.listWorkspaces)
        await harness.model.workspaceReload?.value
    }

    @Test func aSessionEndedOnASocketSignsOut() async throws {
        let harness = try await watchHarness()
        harness.signals.fail(harness.watchKey(inboxIdentifier), with: .unauthorized)
        await harness.signals.cancelled(harness.watchKey(launchIdentifier))
        #expect(harness.model.phase == .signedOut(notice: .sessionEnded))
        #expect(harness.pause.durations == [])
    }

    @Test func aStaleWatchsSessionEndedLeavesTheNewSessionSignedIn() async throws {
        let harness = try await watchHarness()
        harness.signals.fail(harness.watchKey(inboxIdentifier), with: .unauthorized)
        await harness.model.signOut()
        await harness.model.signIn(identity: "walker-2")
        await harness.model.refresh()
        #expect(harness.model.phase == .ready)
        #expect(harness.vault.secret == harness.service.issuedSession.sessionToken)
    }

    @Test func anUnreachableWatchMarksTheModelOfflineBeforeItReconnects() async throws {
        let harness = try await watchHarness()
        #expect(harness.model.syncStatus == .online)
        harness.signals.fail(harness.watchKey(inboxIdentifier), with: .unreachable)
        await harness.pause.started()
        #expect(harness.model.syncStatus == .offline(waiting: 0))
        harness.pause.release()
    }

    @Test func anAnswerBetweenTwoWatchFailuresKeepsTheModelOnline() async throws {
        let harness = try await watchHarness()
        let inbox = harness.watchKey(inboxIdentifier)
        harness.signals.fail(inbox, with: .unreachable)
        await harness.pause.started()
        #expect(harness.model.syncStatus == .offline(waiting: 0))
        await harness.model.refresh()
        #expect(harness.model.syncStatus == .online)
        harness.pause.release()
        await harness.signals.opened(inbox, count: 2)
        harness.signals.fail(inbox, with: .unreachable)
        await harness.pause.started(count: 2)
        #expect(harness.model.syncStatus == .online)
        harness.pause.release()
    }

    @Test func aStaleWatchsFailureLeavesTheNewSessionOnline() async throws {
        let harness = try await watchHarness()
        harness.signals.fail(harness.watchKey(inboxIdentifier), with: .unreachable)
        await harness.model.signOut()
        await harness.model.signIn(identity: "walker-2")
        await harness.model.refresh()
        #expect(harness.model.syncStatus == .online)
    }

    @Test func aMissingProjectKeepsTheModelOnlineWhileItsWatchReloads() async throws {
        let harness = try await watchHarness()
        harness.service.suspend(.listWorkspaces)
        harness.signals.fail(harness.watchKey(launchIdentifier), with: .notFound)
        await harness.pause.started()
        #expect(harness.model.syncStatus == .online)
        await harness.service.held(.listWorkspaces)
        harness.service.resume(.listWorkspaces)
        await harness.model.workspaceReload?.value
    }

    @Test func aProjectThatLeavesTheListHasItsProjectFileErased() async throws {
        let harness = try await watchHarness()
        withoutLaunch(harness)
        harness.service.failures[.renameProject] = .notFound
        await harness.model.renameProject(projectIdentifier: inboxIdentifier, name: "Mine")
        await harness.signals.cancelled(harness.watchKey(launchIdentifier))
        #expect(harness.store.calls.contains(.eraseProject(identifier: launchIdentifier)))
        #expect(!harness.store.calls.contains(.eraseProject(identifier: inboxIdentifier)))
        #expect(harness.model.board.tasks(projectIdentifier: launchIdentifier).isEmpty)
    }

    @Test func aWorkspaceSwitchErasesNoProjectFile() async throws {
        let harness = try await watchHarness()
        harness.store.calls = []
        await harness.model.switchWorkspace(identifier: "side")
        await harness.signals.cancelled(harness.watchKey(inboxIdentifier))
        #expect(!harness.store.routes().contains(.eraseProject))
    }

    @Test func aWatchThatEndsWithoutAnErrorIsNotReopened() async throws {
        let harness = try await watchHarness()
        harness.signals.end(harness.watchKey(inboxIdentifier))
        await harness.model.refresh()
        await harness.model.refresh()
        #expect(harness.signals.openCount(of: harness.watchKey(inboxIdentifier)) == 1)
        #expect(harness.pause.durations == [])
        #expect(harness.model.phase == .ready)
    }
}
