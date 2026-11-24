import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let firstTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)
private let addToInbox = WriteTarget.newTask(projectIdentifier: inboxIdentifier)

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

    @Test func anAddWhileAnotherIsInFlightKeepsTheFirstDraft() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        harness.service.suspend(.addTasks)
        let firstAdd = Task { await harness.model.addTask(title: "First", projectIdentifier: inboxIdentifier, dueDate: nil) }
        await harness.service.held(.addTasks)
        harness.service.unsuspend(.addTasks)
        await harness.model.addTask(title: "Second", projectIdentifier: inboxIdentifier, dueDate: nil)
        let first = TaskDraft(title: "First", notes: nil, dueDate: nil, idempotencyKey: "key-1")
        #expect(harness.model.unconfirmedDrafts == [addToInbox: first])
        harness.service.resume(.addTasks)
        await firstAdd.value
        #expect(harness.service.calls == [.addTasks(session: harness.session, projectIdentifier: inboxIdentifier, drafts: [first])])
        #expect(harness.model.unconfirmedDrafts == [:])
    }

    @Test func tryAgainWhileAnotherAddIsInFlightKeepsTheBannerUntilItsAddIsSent() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        await harness.signedIn()
        harness.service.failures[.addTasks] = .unreachable
        await harness.model.addTask(title: "First", projectIdentifier: inboxIdentifier, dueDate: nil)
        harness.service.failures = [:]
        harness.service.suspend(.addTasks)
        let secondAdd = Task { await harness.model.addTask(title: "Second", projectIdentifier: inboxIdentifier, dueDate: nil) }
        await harness.service.held(.addTasks)
        harness.service.unsuspend(.addTasks)
        await harness.model.tryAgain()
        let first = TaskDraft(title: "First", notes: nil, dueDate: nil, idempotencyKey: "key-1")
        let second = TaskDraft(title: "Second", notes: nil, dueDate: nil, idempotencyKey: "key-2")
        #expect(harness.model.banner == .network)
        #expect(harness.model.canTryAgain)
        #expect(harness.model.unconfirmedDrafts == [addToInbox: second])
        harness.service.resume(.addTasks)
        await secondAdd.value
        await harness.model.tryAgain()
        let adds = [first, second, first].map { FakeCall.addTasks(session: harness.session, projectIdentifier: inboxIdentifier, drafts: [$0]) }
        #expect(harness.service.calls == adds)
        #expect(harness.model.taskViews?.inbox.map(\.task.title).sorted() == ["First", "Second"])
        #expect(harness.model.banner == nil)
        #expect(harness.model.unconfirmedDrafts == [:])
    }

    @Test func aProjectCreatedAfterASwitchIsThereOnTheWayBack() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side")
        await harness.signedIn()
        harness.service.suspend(.createProject)
        let creating = Task { await harness.model.createProject(name: "Garden") }
        await harness.service.held(.createProject)
        await harness.model.switchWorkspace(identifier: side.identifier)
        let loadsOfSide = harness.model.projectLoads
        harness.service.resume(.createProject)
        let created = try #require(await creating.value)
        #expect(harness.model.selectedItem == .inbox)
        #expect(harness.model.projectLoads == loadsOfSide)
        await harness.model.switchWorkspace(identifier: acme.identifier)
        #expect(harness.model.activeWorkspace?.projects.map(\.name) == ["Inbox", "Garden"])
        #expect(harness.model.projectLoads[created.identifier] == .loaded)
    }

    @Test func aProjectRenamedAfterASwitchIsRenamedOnTheWayBack() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        let side = harness.seedWorkspace(name: "side")
        await harness.signedIn()
        harness.service.suspend(.renameProject)
        let renaming = Task { await harness.model.renameProject(projectIdentifier: "acme-launch", name: "Ship") }
        await harness.service.held(.renameProject)
        await harness.model.switchWorkspace(identifier: side.identifier)
        harness.service.resume(.renameProject)
        await renaming.value
        #expect(harness.model.activeWorkspace == side)
        await harness.model.switchWorkspace(identifier: acme.identifier)
        #expect(harness.model.activeWorkspace?.projects.map(\.name) == ["Inbox", "Ship"])
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
