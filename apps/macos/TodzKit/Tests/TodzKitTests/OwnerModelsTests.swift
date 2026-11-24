import Foundation
import Testing
@testable import TodzKit

private let timeZone = "America/Sao_Paulo"
private let agentActorsWithoutAClientName = [
    "{\"kind\":\"agent\",\"client_name\":null}",
    "{\"kind\":\"agent\",\"client_name\":\"\"}",
    "{\"kind\":\"agent\"}",
]

@Suite struct OwnerModelsTests {
    @Test func decodesTheOwner() throws {
        let identifier = UUID().uuidString
        let owner = try OwnerFixtures.decoded(Owner.self, from: OwnerFixtures.ownerJSON(identifier: identifier, timeZone: timeZone))
        #expect(owner == Owner(identifier: identifier, timeZone: timeZone))
    }

    @Test func decodesAWorkspaceWithItsProjectsInboxFirst() throws {
        let workspaceIdentifier = UUID().uuidString
        let inboxIdentifier = UUID().uuidString
        let projectIdentifier = UUID().uuidString
        let json = OwnerFixtures.workspaceJSON(
            identifier: workspaceIdentifier,
            name: "Acme",
            projects: [
                OwnerFixtures.projectJSON(identifier: inboxIdentifier, name: "Inbox", isInbox: true),
                OwnerFixtures.projectJSON(identifier: projectIdentifier, name: "Launch", isInbox: false),
            ]
        )
        let workspace = try OwnerFixtures.decoded(Workspace.self, from: json)
        let createdAt = OwnerFixtures.date(milliseconds: OwnerFixtures.createdAtMilliseconds)
        #expect(
            workspace
                == Workspace(
                    identifier: workspaceIdentifier,
                    name: "Acme",
                    createdAt: createdAt,
                    projects: [
                        Project(identifier: inboxIdentifier, name: "Inbox", isInbox: true, createdAt: createdAt),
                        Project(identifier: projectIdentifier, name: "Launch", isInbox: false, createdAt: createdAt),
                    ]
                )
        )
    }

    @Test func decodesAnOpenTaskWithoutNotesAndCompletion() throws {
        let task = try OwnerFixtures.decoded(TaskRecord.self, from: OwnerFixtures.openTaskJSON(number: 3))
        #expect(task == OwnerFixtures.openTask(number: 3))
        #expect(task.notes == nil)
        #expect(task.completedAt == nil)
        #expect(task.dueDate == CalendarDate(year: 2026, month: 11, day: 24))
    }

    @Test func decodesADoneTaskAddedByAnAgent() throws {
        let idempotencyKey = UUID().uuidString.lowercased()
        let task = try OwnerFixtures.decoded(TaskRecord.self, from: OwnerFixtures.doneTaskJSON(number: 4, idempotencyKey: idempotencyKey))
        #expect(task == OwnerFixtures.doneTask(number: 4, idempotencyKey: idempotencyKey))
        #expect(task.dueDate == nil)
        #expect(task.createdAt.timeIntervalSince1970 == 1_795_000_000.123)
    }

    @Test func refusesATaskInAStateTheAppDoesNotKnow() {
        #expect(throws: DecodingError.self) {
            try OwnerFixtures.decoded(TaskRecord.self, from: OwnerFixtures.openTaskJSON(number: 3, state: "archived"))
        }
    }

    @Test func refusesATaskWithAMalformedDueDate() {
        let json = OwnerFixtures.openTaskJSON(number: 3).replacingOccurrences(of: "2026-11-24", with: "tomorrow")
        #expect(throws: DecodingError.self) { try OwnerFixtures.decoded(TaskRecord.self, from: json) }
    }

    @Test func decodesTheOwnerActorAndAnAgentActor() throws {
        #expect(try OwnerFixtures.decoded(ChangeActor.self, from: OwnerFixtures.ownerActorJSON) == ChangeActor(kind: .owner, clientName: nil))
        #expect(
            try OwnerFixtures.decoded(ChangeActor.self, from: OwnerFixtures.agentActorJSON)
                == ChangeActor(kind: .agent, clientName: OwnerFixtures.agentClientName)
        )
    }

    @Test(arguments: agentActorsWithoutAClientName)
    func refusesAnAgentActorWithoutAClientName(json: String) {
        #expect(throws: DecodingError.self) { try OwnerFixtures.decoded(ChangeActor.self, from: json) }
    }

    @Test func decodesHistoryEntries() throws {
        let update = try OwnerFixtures.decoded(HistoryEntry.self, from: OwnerFixtures.historyEntryJSON)
        let completion = try OwnerFixtures.decoded(HistoryEntry.self, from: OwnerFixtures.completionEntryJSON)
        #expect(
            update
                == HistoryEntry(
                    at: OwnerFixtures.date(milliseconds: OwnerFixtures.updatedAtMilliseconds),
                    actor: ChangeActor(kind: .agent, clientName: OwnerFixtures.agentClientName),
                    action: .updated,
                    fields: [.title, .dueDate],
                    note: nil
                )
        )
        #expect(completion.action == .completed)
        #expect(completion.fields == [])
        #expect(completion.note == "Paid")
    }

    @Test func decodesAChangePage() throws {
        let json = "{\"tasks\":[\(OwnerFixtures.openTaskJSON(number: 1))],\"cursor\":7,\"has_more\":true}"
        let page = try OwnerFixtures.decoded(ChangePage.self, from: json)
        #expect(page == ChangePage(tasks: [OwnerFixtures.openTask(number: 1)], cursor: 7, hasMore: true))
    }

    @Test func decodesTheSignInAnswer() throws {
        let sessionToken = UUID().uuidString
        let ownerIdentifier = UUID().uuidString
        let json = "{\"session_token\":\"\(sessionToken)\",\"owner\":\(OwnerFixtures.ownerJSON(identifier: ownerIdentifier, timeZone: timeZone))}"
        let issued = try OwnerFixtures.decoded(IssuedSession.self, from: json)
        #expect(issued == IssuedSession(sessionToken: sessionToken, owner: Owner(identifier: ownerIdentifier, timeZone: timeZone)))
    }

    @Test func holdsTheLimitsOfLibsCore() {
        #expect(TaskLimits.titleMaxLength == 200)
        #expect(TaskLimits.notesMaxLength == 20_000)
        #expect(TaskLimits.nameMaxLength == 80)
    }
}
