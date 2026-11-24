import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let firstTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)

extension AppModelTests {
    @Test func aSessionEndedAnswerToAnEarlierSessionLeavesTheCurrentOneSignedIn() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 1)
        await harness.signedIn()
        harness.service.suspend(.completeTasks)
        let completing = Task { await harness.model.complete(task: firstTask) }
        await harness.service.held(.completeTasks)
        await harness.model.signOut()
        await harness.model.signIn(identity: "walker-2")
        harness.service.failures[.completeTasks] = .unauthorized
        harness.service.resume(.completeTasks)
        await completing.value
        #expect(harness.vault.secret == harness.service.issuedSession.sessionToken)
        #expect(harness.model.phase == .ready)
    }

    @Test func tryAgainForAProjectOfAnEarlierWorkspaceChangesNothingInTheCurrentOne() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["alpha"])
        let side = harness.seedWorkspace(name: "side")
        harness.seedTasks(projectIdentifier: "acme-alpha", count: 2)
        harness.seedTasks(projectIdentifier: "side-inbox", count: 1)
        harness.service.projectFailures["acme-alpha"] = .unexpected(status: 500)
        await harness.signedIn()
        #expect(harness.model.banner == .someProjectsFailed)
        await harness.model.switchWorkspace(identifier: side.identifier)
        let boardOfSide = harness.model.board
        let loadsOfSide = harness.model.projectLoads
        #expect(harness.model.banner == nil)
        harness.service.projectFailures["acme-alpha"] = nil
        harness.service.calls = []
        await harness.model.tryAgain()
        #expect(harness.service.calls == [])
        #expect(harness.model.board == boardOfSide)
        #expect(harness.model.projectLoads == loadsOfSide)
        #expect(harness.model.banner == nil)
    }

    @Test func anAddAnsweredAfterASwitchLeavesTheOtherWorkspaceUntouched() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side")
        harness.seedTasks(projectIdentifier: "side-inbox", count: 1)
        await harness.signedIn()
        harness.service.suspend(.addTasks)
        let adding = Task { await harness.model.addTask(title: "Late", projectIdentifier: inboxIdentifier, dueDate: nil) }
        await harness.service.held(.addTasks)
        await harness.model.switchWorkspace(identifier: side.identifier)
        let boardOfSide = harness.model.board
        harness.service.resume(.addTasks)
        await adding.value
        #expect(harness.model.board == boardOfSide)
        #expect(harness.model.selectedTask == nil)
    }

    @Test func aWriteFailingAfterASwitchRaisesNothingInTheOtherWorkspace() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 1)
        await harness.signedIn()
        harness.service.suspend(.completeTasks)
        let completing = Task { await harness.model.complete(task: firstTask) }
        await harness.service.held(.completeTasks)
        await harness.model.switchWorkspace(identifier: side.identifier)
        harness.service.failures[.completeTasks] = .unreachable
        harness.service.resume(.completeTasks)
        await completing.value
        #expect(harness.model.banner == nil)
        #expect(harness.model.canTryAgain == false)
    }

    @Test func aSecondNewWorkspaceWhileTheFirstIsInFlightSendsNothing() async throws {
        let harness = try AppModelHarness()
        await harness.signedIn()
        harness.service.suspend(.createWorkspace)
        let firstCreate = Task { await harness.model.createWorkspace(name: "Acme") }
        await harness.service.held(.createWorkspace)
        harness.service.unsuspend(.createWorkspace)
        let secondCreate = await harness.model.createWorkspace(name: "Acme")
        harness.service.resume(.createWorkspace)
        await firstCreate.value
        #expect(secondCreate == nil)
        #expect(harness.service.routes().filter { $0 == .createWorkspace } == [.createWorkspace])
        #expect(harness.model.workspaces.count == 1)
    }

    @Test func aSecondTitleSaveWhileTheFirstIsInFlightSendsNothing() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 1)
        await harness.signedIn()
        harness.service.suspend(.updateTask)
        let firstSave = Task { await harness.model.updateTitle(task: firstTask, title: "Renamed") }
        await harness.service.held(.updateTask)
        harness.service.unsuspend(.updateTask)
        await harness.model.updateTitle(task: firstTask, title: "Renamed")
        harness.service.resume(.updateTask)
        await firstSave.value
        #expect(harness.service.routes() == [.updateTask])
    }

    @Test func anEarlierPullEndingLeavesALaterOneInFlight() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        harness.service.suspend(.readChanges)
        let firstRefresh = Task { await harness.model.refresh() }
        await harness.service.held(.readChanges)
        let secondRefresh = Task { await harness.model.refresh() }
        await harness.service.held(.readChanges, count: 2)
        harness.service.resume(.readChanges)
        await firstRefresh.value
        #expect(harness.model.pullsInFlight.isEmpty == false)
        harness.service.resume(.readChanges)
        await secondRefresh.value
        #expect(harness.model.pullsInFlight.isEmpty)
    }
}
