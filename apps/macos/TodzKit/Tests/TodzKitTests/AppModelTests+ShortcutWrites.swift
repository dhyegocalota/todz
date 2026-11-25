import Testing
@testable import TodzKit

private let firstTask = TaskKey(projectIdentifier: shortcutInboxIdentifier, number: 1)

extension AppModelTests {
    @MainActor private func offline(harness: AppModelHarness, failing route: FakeRoute) async {
        harness.service.failures[.readChanges] = .unreachable
        await harness.model.refresh()
        harness.service.failures[route] = .unreachable
    }

    @Test func anAddDueTodayGoesToTheInboxDueToday() async throws {
        let harness = try await todayHarness(openCount: 0)
        harness.service.suspend(.addTasks)
        let addition = await harness.model.addFromShortcut(title: "Book the dentist", isDueToday: true)
        #expect(addition == .added(title: "Book the dentist", destination: .today, workspaceName: "acme", isOffline: false))
        let draft = TaskDraft(title: "Book the dentist", notes: nil, dueDate: harness.model.today, idempotencyKey: "key-1")
        #expect(harness.model.outbox == Outbox().appending(.add(projectIdentifier: shortcutInboxIdentifier, draft: draft), isHeadSent: false))
        harness.service.resume(.addTasks)
        await harness.flushed()
    }

    @Test func anAddNotDueTodayGoesToTheInboxWithNoDate() async throws {
        let harness = try await todayHarness(openCount: 0)
        harness.service.suspend(.addTasks)
        let addition = await harness.model.addFromShortcut(title: "Book the dentist", isDueToday: false)
        #expect(addition == .added(title: "Book the dentist", destination: .inbox, workspaceName: "acme", isOffline: false))
        let draft = TaskDraft(title: "Book the dentist", notes: nil, dueDate: nil, idempotencyKey: "key-1")
        #expect(harness.model.outbox == Outbox().appending(.add(projectIdentifier: shortcutInboxIdentifier, draft: draft), isHeadSent: false))
        harness.service.resume(.addTasks)
        await harness.flushed()
    }

    @Test func anAddKeepsTheSelectedTaskSelected() async throws {
        let harness = try await todayHarness(openCount: 1)
        harness.model.selectedTask = firstTask
        _ = await harness.model.addFromShortcut(title: "Book the dentist", isDueToday: true)
        await harness.flushed()
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.selectedTask == firstTask)
    }

    @Test(arguments: ["", "   "])
    func aBlankTitleIsRefusedAndNothingIsQueued(title: String) async throws {
        let harness = try await todayHarness(openCount: 0)
        #expect(await harness.model.addFromShortcut(title: title, isDueToday: true) == .refused(.titleEmpty))
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func aTitleOfTwoHundredCharactersIsAdded() async throws {
        let harness = try await todayHarness(openCount: 0)
        let title = String(repeating: "a", count: TaskLimits.titleMaxLength)
        #expect(await harness.model.addFromShortcut(title: title, isDueToday: true) == .added(title: title, destination: .today, workspaceName: "acme", isOffline: false))
        await harness.flushed()
    }

    @Test func aTitleOfTwoHundredAndOneCharactersIsRefusedAndNothingIsQueued() async throws {
        let harness = try await todayHarness(openCount: 0)
        let title = String(repeating: "a", count: TaskLimits.titleMaxLength + 1)
        #expect(await harness.model.addFromShortcut(title: title, isDueToday: true) == .refused(.titleTooLong))
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func anEmojiTitleIsKeptAsTyped() async throws {
        let harness = try await todayHarness(openCount: 0)
        harness.service.suspend(.addTasks)
        let addition = await harness.model.addFromShortcut(title: "🦷 Book the dentist", isDueToday: true)
        #expect(addition == .added(title: "🦷 Book the dentist", destination: .today, workspaceName: "acme", isOffline: false))
        #expect(harness.model.outbox.pendingTasks.map(\.title) == ["🦷 Book the dentist"])
        harness.service.resume(.addTasks)
        await harness.flushed()
    }

    @Test func anAddWhileOfflineSaysSoAndKeepsTheChangeInTheStore() async throws {
        let harness = try await todayHarness(openCount: 0)
        await offline(harness: harness, failing: .addTasks)
        let addition = await harness.model.addFromShortcut(title: "Book the dentist", isDueToday: true)
        #expect(addition == .added(title: "Book the dentist", destination: .today, workspaceName: "acme", isOffline: true))
        await harness.pause.started()
        #expect(harness.model.waitingChangeCount == 1)
        #expect(try harness.store.storedOutbox()?.pendingTasks.map(\.title) == ["Book the dentist"])
        harness.service.failures = [:]
        harness.pause.release()
        await harness.flushed()
    }

    @Test func anAddWhileSignedOutIsSignedOutAndQueuesNothing() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        #expect(await harness.model.addFromShortcut(title: "Book the dentist", isDueToday: true) == .signedOut)
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func anAddWithNoWorkspaceHasNoWorkspaceAndQueuesNothing() async throws {
        let harness = try AppModelHarness()
        await harness.signedIn()
        #expect(harness.model.phase == .naming)
        #expect(await harness.model.addFromShortcut(title: "Book the dentist", isDueToday: true) == .noWorkspace)
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func anAddAfterAWorkspaceSwitchGoesToTheNewInboxAndNamesIt() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side")
        await harness.signedIn()
        await harness.model.switchWorkspace(identifier: side.identifier)
        harness.service.suspend(.addTasks)
        let addition = await harness.model.addFromShortcut(title: "Water the garden", isDueToday: true)
        #expect(addition == .added(title: "Water the garden", destination: .today, workspaceName: "side", isOffline: false))
        #expect(harness.model.outbox.pendingChanges.map(\.projectIdentifier) == ["side-inbox"])
        harness.service.resume(.addTasks)
        await harness.flushed()
    }

    @Test func anOpenTodayTaskIsCompleted() async throws {
        let harness = try await todayHarness(openCount: 1)
        harness.service.suspend(.completeTasks)
        #expect(await harness.model.completeFromShortcut(key: firstTask) == .completed(title: "Task 1", isOffline: false))
        #expect(harness.model.outbox == Outbox().appending(.state(firstTask, .done, at: fixedInstant), isHeadSent: false))
        harness.service.resume(.completeTasks)
        await harness.flushed()
    }

    @Test func anOpenUndatedInboxTaskIsCompleted() async throws {
        let harness = try await shortcutHarness { _ in [MutableTask(number: 1, title: "Someday")] }
        #expect(await harness.model.completeFromShortcut(key: firstTask) == .completed(title: "Someday", isOffline: false))
        await harness.flushed()
        #expect(harness.service.routes().contains(.completeTasks))
    }

    @Test func aDoneTaskIsAlreadyDoneAndNothingIsQueued() async throws {
        let harness = try await shortcutHarness { today in
            [MutableTask(number: 1, title: "Pay rent", dueDate: today, state: .done, completedAt: fixedInstant)]
        }
        #expect(await harness.model.completeFromShortcut(key: firstTask) == .alreadyDone(title: "Pay rent"))
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func anUnknownNumberIsNotFound() async throws {
        let harness = try await todayHarness(openCount: 1)
        #expect(await harness.model.completeFromShortcut(key: TaskKey(projectIdentifier: shortcutInboxIdentifier, number: 99)) == .notFound)
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func aTaskOfAnotherWorkspaceIsNotFoundAndNothingIsQueued() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedWorkspace(name: "side")
        harness.service.tasksOfProject["side-inbox"] = [MutableTask(number: 1, title: "Water the garden").record]
        await harness.signedIn()
        #expect(await harness.model.completeFromShortcut(key: TaskKey(projectIdentifier: "side-inbox", number: 1)) == .notFound)
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func aCompletionWhileOfflineSaysSoAndKeepsTheChangeInTheStore() async throws {
        let harness = try await todayHarness(openCount: 1)
        await offline(harness: harness, failing: .completeTasks)
        #expect(await harness.model.completeFromShortcut(key: firstTask) == .completed(title: "Task 1", isOffline: true))
        await harness.pause.started()
        #expect(harness.model.waitingChangeCount == 1)
        #expect(try harness.store.storedOutbox()?.count == 1)
        harness.service.failures = [:]
        harness.pause.release()
        await harness.flushed()
    }

    @Test func aCompletionWhileSignedOutIsSignedOut() async throws {
        let harness = try AppModelHarness()
        await harness.model.launch()
        #expect(await harness.model.completeFromShortcut(key: firstTask) == .signedOut)
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func completingTheSameTaskTwiceAnswersAlreadyDoneTheSecondTime() async throws {
        let harness = try await todayHarness(openCount: 1)
        harness.service.suspend(.completeTasks)
        #expect(await harness.model.completeFromShortcut(key: firstTask) == .completed(title: "Task 1", isOffline: false))
        #expect(await harness.model.completeFromShortcut(key: firstTask) == .alreadyDone(title: "Task 1"))
        #expect(harness.model.waitingChangeCount == 1)
        harness.service.resume(.completeTasks)
        await harness.flushed()
    }
}
