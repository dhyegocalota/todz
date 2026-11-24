import Foundation
import Testing
@testable import TodzKit

extension OwnerModelsTests {
    @Test func unwrapsTheOwnerAnswer() throws {
        let identifier = UUID().uuidString
        let json = "{\"owner\":\(OwnerFixtures.ownerJSON(identifier: identifier, timeZone: "Europe/Lisbon"))}"
        #expect(try OwnerFixtures.decoded(OwnerAnswer.self, from: json).owner == Owner(identifier: identifier, timeZone: "Europe/Lisbon"))
    }

    @Test func unwrapsTheWorkspacesAndWorkspaceAnswers() throws {
        let identifier = UUID().uuidString
        let inboxIdentifier = UUID().uuidString
        let workspaceJSON = OwnerFixtures.workspaceJSON(
            identifier: identifier,
            name: "Acme",
            projects: [OwnerFixtures.projectJSON(identifier: inboxIdentifier, name: "Inbox", isInbox: true)]
        )
        let listed = try OwnerFixtures.decoded(WorkspacesAnswer.self, from: "{\"workspaces\":[\(workspaceJSON)]}").workspaces
        let created = try OwnerFixtures.decoded(WorkspaceAnswer.self, from: "{\"workspace\":\(workspaceJSON)}").workspace
        #expect(listed.map(\.identifier) == [identifier])
        #expect(created.projects.map(\.identifier) == [inboxIdentifier])
        #expect(created.projects.map(\.isInbox) == [true])
    }

    @Test func unwrapsTheProjectAnswer() throws {
        let identifier = UUID().uuidString
        let json = "{\"project\":\(OwnerFixtures.projectJSON(identifier: identifier, name: "Launch", isInbox: false))}"
        let project = try OwnerFixtures.decoded(ProjectAnswer.self, from: json).project
        #expect(project.identifier == identifier)
        #expect(project.name == "Launch")
    }

    @Test func unwrapsTheTaskAnswer() throws {
        let json = "{\"task\":\(OwnerFixtures.openTaskJSON(number: 9))}"
        #expect(try OwnerFixtures.decoded(TaskAnswer.self, from: json).task == OwnerFixtures.openTask(number: 9))
    }

    @Test func unwrapsTheAddedTasksAnswer() throws {
        let json = "{\"tasks\":[{\"task\":\(OwnerFixtures.openTaskJSON(number: 1)),\"replayed\":true}]}"
        let added = try OwnerFixtures.decoded(AddedTasksAnswer.self, from: json).tasks
        #expect(added == [AddedTask(task: OwnerFixtures.openTask(number: 1), replayed: true)])
    }

    @Test func unwrapsTheCompletedTasksAnswer() throws {
        let idempotencyKey = UUID().uuidString.lowercased()
        let json = "{\"tasks\":[{\"task\":\(OwnerFixtures.doneTaskJSON(number: 2, idempotencyKey: idempotencyKey)),\"already_done\":false}]}"
        let completed = try OwnerFixtures.decoded(CompletedTasksAnswer.self, from: json).tasks
        #expect(completed == [CompletedTask(task: OwnerFixtures.doneTask(number: 2, idempotencyKey: idempotencyKey), alreadyDone: false)])
    }

    @Test func unwrapsTheReopenedTasksAnswer() throws {
        let json = "{\"tasks\":[{\"task\":\(OwnerFixtures.openTaskJSON(number: 2)),\"already_open\":true}]}"
        let reopened = try OwnerFixtures.decoded(ReopenedTasksAnswer.self, from: json).tasks
        #expect(reopened == [ReopenedTask(task: OwnerFixtures.openTask(number: 2), alreadyOpen: true)])
    }

    @Test func unwrapsTheHistoryAnswer() throws {
        let json = "{\"history\":[\(OwnerFixtures.historyEntryJSON),\(OwnerFixtures.completionEntryJSON)]}"
        let history = try OwnerFixtures.decoded(HistoryAnswer.self, from: json).history
        #expect(history.map(\.action) == [.updated, .completed])
    }
}
