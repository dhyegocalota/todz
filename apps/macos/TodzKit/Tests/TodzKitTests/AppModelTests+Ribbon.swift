import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let agent = ChangeActor.agent(clientName: "claude-code")

extension AppModelTests {
    @MainActor private func ribbonHarness() throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        harness.seedWorkspace(name: "side")
        harness.service.tasksOfProject[inboxIdentifier] = [
            MutableTask(number: 1, title: "Due today", dueDate: harness.model.today).record,
            MutableTask(number: 2, title: "Also today", dueDate: harness.model.today).record,
        ]
        return harness
    }

    @MainActor private func agentTask(_ number: Int, in harness: AppModelHarness) -> TaskRecord {
        var task = MutableTask(number: number, title: "From an agent", dueDate: harness.model.today)
        task.createdBy = agent
        return task.record
    }

    @MainActor private func doneTask(_ number: Int, in harness: AppModelHarness) -> TaskRecord {
        MutableTask(number: number, title: "Due today", dueDate: harness.model.today, state: .done, completedAt: fixedInstant).record
    }

    @MainActor private func scriptPull(_ tasks: [TaskRecord], in harness: AppModelHarness) {
        let page = ChangePage(tasks: tasks, cursor: 2 + tasks.count, hasMore: false)
        harness.service.changeScripts[inboxIdentifier] = [.success(page)]
    }

    @Test func aSecondPullWithOneAgentTaskDueTodayCountsOnce() async throws {
        let harness = try ribbonHarness()
        await harness.signedIn()
        scriptPull([agentTask(3, in: harness)], in: harness)
        await harness.model.pullProject(identifier: inboxIdentifier)
        #expect(harness.model.agentChangeCount == 1)
    }

    @Test func aSecondPullWithTwoAgentTasksDueTodayCountsOnce() async throws {
        let harness = try ribbonHarness()
        await harness.signedIn()
        scriptPull([agentTask(3, in: harness), agentTask(4, in: harness)], in: harness)
        await harness.model.pullProject(identifier: inboxIdentifier)
        #expect(harness.model.agentChangeCount == 1)
    }

    @Test func theFirstPullOfAProjectCountsNothing() async throws {
        let harness = try ribbonHarness()
        harness.service.tasksOfProject[inboxIdentifier]?.append(agentTask(3, in: harness))
        await harness.signedIn()
        #expect(harness.model.board.tasks(projectIdentifier: inboxIdentifier).count == 3)
        #expect(harness.model.agentChangeCount == 0)
    }

    @Test func aPullFromTheStartCountsNothing() async throws {
        let harness = try ribbonHarness()
        await harness.signedIn()
        harness.service.tasksOfProject[inboxIdentifier]?.append(agentTask(3, in: harness))
        harness.service.changeScripts[inboxIdentifier] = [.failure(.cursorAhead)]
        await harness.model.pullProject(identifier: inboxIdentifier)
        #expect(harness.model.board.tasks(projectIdentifier: inboxIdentifier).count == 3)
        #expect(harness.model.agentChangeCount == 0)
    }

    @Test func aSecondPullWithAnOwnerTaskCountsNothing() async throws {
        let harness = try ribbonHarness()
        await harness.signedIn()
        scriptPull([MutableTask(number: 3, title: "From the owner", dueDate: harness.model.today).record], in: harness)
        await harness.model.pullProject(identifier: inboxIdentifier)
        #expect(harness.model.board.tasks(projectIdentifier: inboxIdentifier).count == 3)
        #expect(harness.model.agentChangeCount == 0)
    }

    @Test func aSecondPullWhereATaskOfTodayArrivesDoneCountsOnce() async throws {
        let harness = try ribbonHarness()
        await harness.signedIn()
        scriptPull([doneTask(1, in: harness)], in: harness)
        await harness.model.pullProject(identifier: inboxIdentifier)
        #expect(harness.model.agentChangeCount == 1)
    }

    @Test func theOwnersOwnCompletionAndThePullThatConfirmsItCountNothing() async throws {
        let harness = try ribbonHarness()
        await harness.signedIn()
        await harness.model.complete(task: TaskKey(projectIdentifier: inboxIdentifier, number: 1))
        await harness.flushed()
        scriptPull([doneTask(1, in: harness)], in: harness)
        await harness.model.pullProject(identifier: inboxIdentifier)
        #expect(harness.model.agentChangeCount == 0)
    }

    @Test func aPullForAProjectOfAnotherWorkspaceAfterASwitchCountsNothing() async throws {
        let harness = try ribbonHarness()
        await harness.signedIn()
        await harness.model.switchWorkspace(identifier: "side")
        scriptPull([agentTask(3, in: harness)], in: harness)
        await harness.model.pullProject(identifier: inboxIdentifier)
        #expect(harness.model.board.tasks(projectIdentifier: inboxIdentifier).isEmpty)
        #expect(harness.model.agentChangeCount == 0)
    }

    @Test func aTaskAlreadyOnTheBoardWithANewTitleCountsNothing() async throws {
        let harness = try ribbonHarness()
        await harness.signedIn()
        let retitled = MutableTask(number: 1, title: "Renamed", dueDate: harness.model.today).record
        scriptPull([retitled], in: harness)
        await harness.model.pullProject(identifier: inboxIdentifier)
        #expect(harness.model.agentChangeCount == 0)
    }

    @Test func aProjectPulledInTwoPagesCountsOnce() async throws {
        let harness = try ribbonHarness()
        await harness.signedIn()
        harness.service.pageSize = 1
        harness.service.tasksOfProject[inboxIdentifier]?.append(contentsOf: [agentTask(3, in: harness), agentTask(4, in: harness)])
        await harness.model.pullProject(identifier: inboxIdentifier)
        #expect(harness.model.board.tasks(projectIdentifier: inboxIdentifier).count == 4)
        #expect(harness.model.agentChangeCount == 1)
    }

    @Test func theRibbonContentIsNoneWhileSignedOut() throws {
        let harness = try ribbonHarness()
        #expect(harness.model.ribbonContent == nil)
    }

    @Test func theRibbonContentCountsTodaysOpenTasksAndNamesTheFirst() async throws {
        let harness = try ribbonHarness()
        await harness.signedIn()
        #expect(harness.model.ribbonContent == .remaining(left: 2, next: RibbonTask(number: 1, title: "Due today")))
    }
}
