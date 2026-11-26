import Foundation
import Testing
@testable import TodzKit

private let baseText = "http://todz.test"
private let jsonContentType = "application/json"
private let timeZone = "America/Sao_Paulo"

struct ExpectedRequest {
    let method: String
    let path: String
    var query: String? = nil
    let session: String?
    let body: [String: Any]?
}

func api(answering answer: StubAnswer) throws -> OwnerAPI {
    let baseURL = try #require(URL(string: baseText))
    return OwnerAPI(baseURL: baseURL, appVersion: OwnerFixtures.appVersion, transport: StubURLProtocol.session(answering: answer))
}

func expectOnlyRequest(_ expected: ExpectedRequest) throws {
    let requests = StubURLProtocol.recordedRequests()
    #expect(requests.count == 1)
    let request = try #require(requests.first)
    #expect(request.method == expected.method)
    #expect(request.path == expected.path)
    #expect(request.query == expected.query)
    #expect(request.authorization == expected.session.map { "Bearer \($0)" })
    guard let body = expected.body else {
        #expect(request.body.isEmpty)
        return
    }
    #expect(request.contentType == jsonContentType)
    let sent = try JSONSerialization.jsonObject(with: request.body) as? NSDictionary
    #expect(sent == body as NSDictionary)
}

private func workspaceJSON(identifier: String, inboxIdentifier: String) -> String {
    OwnerFixtures.workspaceJSON(
        identifier: identifier,
        name: "Acme",
        projects: [OwnerFixtures.projectJSON(identifier: inboxIdentifier, name: "Inbox", isInbox: true)]
    )
}

@Suite(.serialized) struct OwnerAPITests {
    let session = UUID().uuidString
    let projectIdentifier = UUID().uuidString.lowercased()

    @Test func signInSendsTheIdentityAndTheZoneWithoutASession() async throws {
        let identity = "dev-\(UUID().uuidString)"
        let sessionToken = UUID().uuidString
        let ownerIdentifier = UUID().uuidString
        let body = "{\"session_token\":\"\(sessionToken)\",\"owner\":\(OwnerFixtures.ownerJSON(identifier: ownerIdentifier, timeZone: timeZone))}"
        let issued = try await api(answering: .response(status: 201, body: body)).signIn(identityToken: identity, linkVerifier: nil, turnstileToken: nil, timeZone: timeZone)
        try expectOnlyRequest(
            ExpectedRequest(method: "POST", path: "/owner/sessions", session: nil, body: ["identity_token": identity, "time_zone": timeZone])
        )
        #expect(issued == IssuedSession(sessionToken: sessionToken, owner: Owner(identifier: ownerIdentifier, timeZone: timeZone)))
    }

    @Test func signOutDeletesTheCurrentSession() async throws {
        try await api(answering: .response(status: 204, body: "")).signOut(session: session)
        try expectOnlyRequest(ExpectedRequest(method: "DELETE", path: "/owner/sessions/current", session: session, body: nil))
    }

    @Test func readOwnerGetsTheOwner() async throws {
        let ownerIdentifier = UUID().uuidString
        let body = "{\"owner\":\(OwnerFixtures.ownerJSON(identifier: ownerIdentifier, timeZone: timeZone))}"
        let owner = try await api(answering: .response(status: 200, body: body)).readOwner(session: session)
        try expectOnlyRequest(ExpectedRequest(method: "GET", path: "/owner", session: session, body: nil))
        #expect(owner == Owner(identifier: ownerIdentifier, timeZone: timeZone))
    }

    @Test func updateOwnerPatchesTheTimeZone() async throws {
        let ownerIdentifier = UUID().uuidString
        let body = "{\"owner\":\(OwnerFixtures.ownerJSON(identifier: ownerIdentifier, timeZone: timeZone))}"
        let owner = try await api(answering: .response(status: 200, body: body)).updateOwner(session: session, timeZone: timeZone)
        try expectOnlyRequest(ExpectedRequest(method: "PATCH", path: "/owner", session: session, body: ["time_zone": timeZone]))
        #expect(owner == Owner(identifier: ownerIdentifier, timeZone: timeZone))
    }

    @Test func readOwnerDecodesTheAgentNudge() async throws {
        let ownerIdentifier = UUID().uuidString
        let body = "{\"owner\":\(OwnerFixtures.ownerJSON(identifier: ownerIdentifier, timeZone: timeZone, agentNudge: true))}"
        let owner = try await api(answering: .response(status: 200, body: body)).readOwner(session: session)
        #expect(owner.agentNudge == true)
    }

    @Test func readOwnerOfAServerWithoutTheAgentNudgeLeavesItUnknown() async throws {
        let body = "{\"owner\":{\"id\":\"o\",\"time_zone\":\"UTC\"}}"
        let owner = try await api(answering: .response(status: 200, body: body)).readOwner(session: session)
        #expect(owner == Owner(identifier: "o", timeZone: "UTC"))
        #expect(owner.agentNudge == nil)
    }

    @Test func updateAgentNudgePatchesOnlyTheAgentNudge() async throws {
        let ownerIdentifier = UUID().uuidString
        let body = "{\"owner\":\(OwnerFixtures.ownerJSON(identifier: ownerIdentifier, timeZone: timeZone, agentNudge: true))}"
        let owner = try await api(answering: .response(status: 200, body: body)).updateAgentNudge(session: session, isEnabled: true)
        try expectOnlyRequest(ExpectedRequest(method: "PATCH", path: "/owner", session: session, body: ["agent_nudge": true]))
        #expect(owner == Owner(identifier: ownerIdentifier, timeZone: timeZone, agentNudge: true))
    }

    @Test func listWorkspacesUnwrapsTheWorkspaces() async throws {
        let identifier = UUID().uuidString
        let body = "{\"workspaces\":[\(workspaceJSON(identifier: identifier, inboxIdentifier: projectIdentifier))]}"
        let workspaces = try await api(answering: .response(status: 200, body: body)).listWorkspaces(session: session)
        try expectOnlyRequest(ExpectedRequest(method: "GET", path: "/owner/workspaces", session: session, body: nil))
        #expect(workspaces.map(\.identifier) == [identifier])
    }

    @Test func createWorkspaceSendsTheName() async throws {
        let identifier = UUID().uuidString
        let body = "{\"workspace\":\(workspaceJSON(identifier: identifier, inboxIdentifier: projectIdentifier))}"
        let workspace = try await api(answering: .response(status: 201, body: body)).createWorkspace(session: session, name: "Acme")
        try expectOnlyRequest(ExpectedRequest(method: "POST", path: "/owner/workspaces", session: session, body: ["name": "Acme"]))
        #expect(workspace.identifier == identifier)
        #expect(workspace.projects.map(\.isInbox) == [true])
    }

    @Test func createProjectPostsIntoTheWorkspace() async throws {
        let workspaceIdentifier = UUID().uuidString.lowercased()
        let body = "{\"project\":\(OwnerFixtures.projectJSON(identifier: projectIdentifier, name: "Launch", isInbox: false))}"
        let project = try await api(answering: .response(status: 201, body: body))
            .createProject(session: session, workspaceIdentifier: workspaceIdentifier, name: "Launch")
        try expectOnlyRequest(
            ExpectedRequest(method: "POST", path: "/owner/workspaces/\(workspaceIdentifier)/projects", session: session, body: ["name": "Launch"])
        )
        #expect(project.identifier == projectIdentifier)
    }

    @Test func renameProjectPatchesTheProject() async throws {
        let body = "{\"project\":\(OwnerFixtures.projectJSON(identifier: projectIdentifier, name: "Ship", isInbox: false))}"
        let project = try await api(answering: .response(status: 200, body: body))
            .renameProject(session: session, projectIdentifier: projectIdentifier, name: "Ship")
        try expectOnlyRequest(ExpectedRequest(method: "PATCH", path: "/owner/projects/\(projectIdentifier)", session: session, body: ["name": "Ship"]))
        #expect(project.name == "Ship")
    }

    @Test func addTasksSendsTheDraftsInSnakeCase() async throws {
        let idempotencyKey = UUID().uuidString.lowercased()
        let draft = TaskDraft(title: "Call the bank", notes: nil, dueDate: CalendarDate(year: 2026, month: 11, day: 24), idempotencyKey: idempotencyKey)
        let body = "{\"tasks\":[{\"task\":\(OwnerFixtures.openTaskJSON(number: 1)),\"replayed\":false}]}"
        let added = try await api(answering: .response(status: 201, body: body))
            .addTasks(session: session, projectIdentifier: projectIdentifier, drafts: [draft])
        try expectOnlyRequest(
            ExpectedRequest(
                method: "POST",
                path: "/owner/projects/\(projectIdentifier)/tasks",
                session: session,
                body: ["tasks": [["title": "Call the bank", "due_date": "2026-11-24", "idempotency_key": idempotencyKey]]]
            )
        )
        #expect(added == [AddedTask(task: OwnerFixtures.openTask(number: 1), replayed: false)])
    }

    @Test(arguments: [
        (TaskPatch.title("Call the bank"), "{\"title\":\"Call the bank\"}"),
        (TaskPatch.notes("Two copies"), "{\"notes\":\"Two copies\"}"),
        (TaskPatch.notes(nil), "{\"notes\":null}"),
        (TaskPatch.dueDate(CalendarDate(year: 2026, month: 12, day: 1)), "{\"due_date\":\"2026-12-01\"}"),
        (TaskPatch.dueDate(nil), "{\"due_date\":null}"),
        (TaskPatch.placement(.first), "{\"placement\":{\"kind\":\"first\"}}"),
        (TaskPatch.placement(.after(anchor: 2)), "{\"placement\":{\"kind\":\"after\",\"anchor\":2}}"),
    ])
    func updateTaskPatchesOneField(patch: TaskPatch, sentJSON: String) async throws {
        let body = "{\"task\":\(OwnerFixtures.openTaskJSON(number: 3))}"
        let sent = try #require(try JSONSerialization.jsonObject(with: Data(sentJSON.utf8)) as? [String: Any])
        let task = try await api(answering: .response(status: 200, body: body))
            .updateTask(session: session, projectIdentifier: projectIdentifier, number: 3, patch: patch)
        try expectOnlyRequest(ExpectedRequest(method: "PATCH", path: "/owner/projects/\(projectIdentifier)/tasks/3", session: session, body: sent))
        #expect(task == OwnerFixtures.openTask(number: 3))
    }

    @Test func completeTasksSendsTheNumbers() async throws {
        let idempotencyKey = UUID().uuidString.lowercased()
        let body = "{\"tasks\":[{\"task\":\(OwnerFixtures.doneTaskJSON(number: 4, idempotencyKey: idempotencyKey)),\"already_done\":false}]}"
        let completed = try await api(answering: .response(status: 200, body: body))
            .completeTasks(session: session, projectIdentifier: projectIdentifier, numbers: [4])
        try expectOnlyRequest(
            ExpectedRequest(method: "POST", path: "/owner/projects/\(projectIdentifier)/tasks/complete", session: session, body: ["numbers": [4]])
        )
        #expect(completed == [CompletedTask(task: OwnerFixtures.doneTask(number: 4, idempotencyKey: idempotencyKey), alreadyDone: false)])
    }

    @Test func reopenTasksSendsTheNumbers() async throws {
        let body = "{\"tasks\":[{\"task\":\(OwnerFixtures.openTaskJSON(number: 4)),\"already_open\":false}]}"
        let reopened = try await api(answering: .response(status: 200, body: body))
            .reopenTasks(session: session, projectIdentifier: projectIdentifier, numbers: [4])
        try expectOnlyRequest(
            ExpectedRequest(method: "POST", path: "/owner/projects/\(projectIdentifier)/tasks/reopen", session: session, body: ["numbers": [4]])
        )
        #expect(reopened == [ReopenedTask(task: OwnerFixtures.openTask(number: 4), alreadyOpen: false)])
    }

    @Test func readHistoryUnwrapsTheEntries() async throws {
        let body = "{\"history\":[\(OwnerFixtures.historyEntryJSON),\(OwnerFixtures.completionEntryJSON)]}"
        let history = try await api(answering: .response(status: 200, body: body))
            .readHistory(session: session, projectIdentifier: projectIdentifier, number: 4)
        try expectOnlyRequest(ExpectedRequest(method: "GET", path: "/owner/projects/\(projectIdentifier)/tasks/4/history", session: session, body: nil))
        #expect(history.map(\.action) == [.updated, .completed])
    }

    @Test func readChangesSendsTheCursor() async throws {
        let body = "{\"tasks\":[\(OwnerFixtures.openTaskJSON(number: 1))],\"deleted_numbers\":[3],\"cursor\":12,\"has_more\":false}"
        let page = try await api(answering: .response(status: 200, body: body))
            .readChanges(session: session, projectIdentifier: projectIdentifier, cursor: 5)
        try expectOnlyRequest(
            ExpectedRequest(method: "GET", path: "/owner/projects/\(projectIdentifier)/changes", query: "cursor=5", session: session, body: nil)
        )
        #expect(page == ChangePage(tasks: [OwnerFixtures.openTask(number: 1)], deletedNumbers: [3], cursor: 12, hasMore: false))
    }

    @Test(arguments: [
        (401, "", OwnerAPIError.unauthorized),
        (401, "{\"error\":\"identity_rejected\"}", .identityRejected),
        (404, "", .unexpected(status: 404)),
        (404, "{\"error\":\"not_found\"}", .notFound),
        (404, "{\"error\":\"task_not_found\",\"number\":7}", .taskNotFound(number: 7)),
        (409, "{\"error\":\"inbox_is_fixed\"}", .inboxIsFixed),
        (409, "{\"error\":\"cursor_ahead\"}", .cursorAhead),
        (422, "{\"error\":\"rule_violated\",\"issue\":\"title_too_long\",\"index\":0}", .ruleViolated(issue: .titleTooLong, index: 0)),
        (422, "{\"error\":\"rule_violated\",\"issue\":\"name_empty\",\"index\":null}", .ruleViolated(issue: .nameEmpty, index: nil)),
        (422, "{\"error\":\"time_zone_invalid\"}", .timeZoneInvalid),
        (400, "{\"error\":\"invalid_request\"}", .invalidRequest),
        (400, "", .unexpected(status: 400)),
        (503, "{\"error\":\"sign_in_unavailable\"}", .signInUnavailable),
        (503, "", .signInUnavailable),
        (511, "<html><body>Sign in to the network</body></html>", .unexpected(status: 511)),
        (500, "", .unexpected(status: 500)),
        (426, "", .appTooOld(minimum: nil)),
        (426, "{\"error\":\"app_too_old\",\"minimum_app_version\":\"0.3.0\"}", .appTooOld(minimum: "0.3.0")),
        (426, "{\"error\":\"app_too_old\"}", .appTooOld(minimum: nil)),
        (426, "<html>upgrade</html>", .appTooOld(minimum: nil)),
        (418, "{\"error\":\"teapot\"}", .unexpected(status: 418)),
    ])
    func mapsEachRowOfTheErrorTable(status: Int, body: String, expected: OwnerAPIError) async throws {
        let api = try api(answering: .response(status: status, body: body))
        await #expect(throws: expected) {
            try await api.readChanges(session: session, projectIdentifier: projectIdentifier, cursor: 0)
        }
    }

    @Test(arguments: [URLError.Code.cannotConnectToHost, .timedOut, .notConnectedToInternet])
    func mapsATransportFailureToUnreachable(code: URLError.Code) async throws {
        let api = try api(answering: .failure(URLError(code)))
        await #expect(throws: OwnerAPIError.unreachable) {
            try await api.listWorkspaces(session: session)
        }
    }

    @Test func theDefaultTransportKeepsNoCache() throws {
        let configuration = OwnerAPI(baseURL: try #require(URL(string: baseText)), appVersion: OwnerFixtures.appVersion).transport.configuration
        #expect(configuration.urlCache == nil)
        #expect(configuration.requestCachePolicy == .reloadIgnoringLocalCacheData)
    }
}
