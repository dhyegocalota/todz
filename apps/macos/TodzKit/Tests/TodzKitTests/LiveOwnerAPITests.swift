import Foundation
import Testing
@testable import TodzKit

private let liveAddressVariable = "TODZ_LIVE_API_URL"
private let liveTimeZone = "America/Sao_Paulo"

private func liveAPI() throws -> OwnerAPI {
    let address = try #require(ProcessInfo.processInfo.environment[liveAddressVariable])
    return OwnerAPI(baseURL: try #require(URL(string: address)))
}

@Suite(.enabled(if: ProcessInfo.processInfo.environment[liveAddressVariable] != nil), .serialized)
struct LiveOwnerAPITests {
    @Test func theShellsRoutesAnswerAsTheModelsDecodeThem() async throws {
        let api = try liveAPI()
        let identity = "live-\(UUID().uuidString.lowercased())"
        let issued = try await api.signIn(identityToken: identity, timeZone: liveTimeZone)
        let session = issued.sessionToken
        #expect(issued.owner.timeZone == liveTimeZone)
        #expect(try await api.updateOwner(session: session, timeZone: liveTimeZone).identifier == issued.owner.identifier)
        #expect(try await api.listWorkspaces(session: session) == [])

        let workspace = try await api.createWorkspace(session: session, name: "Acme")
        let inbox = try #require(workspace.projects.first)
        #expect(inbox.isInbox)
        #expect(try await api.listWorkspaces(session: session) == [workspace])

        let project = try await api.createProject(session: session, workspaceIdentifier: workspace.identifier, name: "Launch")
        #expect(try await api.renameProject(session: session, projectIdentifier: project.identifier, name: "Ship").name == "Ship")
        await #expect(throws: OwnerAPIError.inboxIsFixed) {
            try await api.renameProject(session: session, projectIdentifier: inbox.identifier, name: "Mine")
        }

        let idempotencyKey = TaskDraft.newIdempotencyKey()
        let draft = TaskDraft(title: "Call the bank", notes: nil, dueDate: CalendarDate(year: 2026, month: 11, day: 24), idempotencyKey: idempotencyKey)
        let added = try await api.addTasks(session: session, projectIdentifier: inbox.identifier, drafts: [draft])
        let task = try #require(added.first?.task)
        #expect(added.map(\.replayed) == [false])
        #expect(task.idempotencyKey == idempotencyKey)
        #expect(task.notes == nil)
        #expect(task.completedAt == nil)
        #expect(try await api.addTasks(session: session, projectIdentifier: inbox.identifier, drafts: [draft]).map(\.replayed) == [true])

        let renamed = try await api.updateTask(session: session, projectIdentifier: inbox.identifier, number: task.number, patch: .title("Call the bank today"))
        let noted = try await api.updateTask(session: session, projectIdentifier: inbox.identifier, number: task.number, patch: .notes("Two copies"))
        let undated = try await api.updateTask(session: session, projectIdentifier: inbox.identifier, number: task.number, patch: .dueDate(nil))
        #expect(renamed.title == "Call the bank today")
        #expect(noted.notes == "Two copies")
        #expect(undated.dueDate == nil)
        await #expect(throws: OwnerAPIError.ruleViolated(issue: .titleEmpty, index: nil)) {
            try await api.updateTask(session: session, projectIdentifier: inbox.identifier, number: task.number, patch: .title(" "))
        }

        let completed = try await api.completeTasks(session: session, projectIdentifier: inbox.identifier, numbers: [task.number])
        #expect(completed.first?.task.state == .done)
        #expect(completed.first?.task.completedAt != nil)
        let reopened = try await api.reopenTasks(session: session, projectIdentifier: inbox.identifier, numbers: [task.number])
        #expect(reopened.first?.task.state == .open)

        let pulled = try await ProjectFeed(service: api).pull(session: session, projectIdentifier: inbox.identifier, cursor: 0)
        #expect(pulled == reopened.map(\.task))
        await #expect(throws: OwnerAPIError.cursorAhead) {
            try await api.readChanges(session: session, projectIdentifier: inbox.identifier, cursor: 1_000)
        }

        let history = try await api.readHistory(session: session, projectIdentifier: inbox.identifier, number: task.number)
        #expect(history.map(\.action) == [.created, .updated, .updated, .updated, .completed, .reopened])
        #expect(history.allSatisfy { $0.actor.kind == .owner })
        await #expect(throws: OwnerAPIError.taskNotFound(number: 99)) {
            try await api.readHistory(session: session, projectIdentifier: inbox.identifier, number: 99)
        }

        try await api.signOut(session: session)
        await #expect(throws: OwnerAPIError.unauthorized) { try await api.listWorkspaces(session: session) }
    }

    @Test func aRefusedIdentityAndZoneMapToTheirErrors() async throws {
        let api = try liveAPI()
        await #expect(throws: OwnerAPIError.identityRejected) {
            try await api.signIn(identityToken: "not a valid identity", timeZone: liveTimeZone)
        }
        await #expect(throws: OwnerAPIError.timeZoneInvalid) {
            try await api.signIn(identityToken: "live-\(UUID().uuidString.lowercased())", timeZone: "+01:00")
        }
        await #expect(throws: OwnerAPIError.unauthorized) { try await api.listWorkspaces(session: UUID().uuidString) }
    }
}
