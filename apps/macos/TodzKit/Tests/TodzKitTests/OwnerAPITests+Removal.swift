import Foundation
import Testing
@testable import TodzKit

private let removalFailures: [(Int, String, OwnerAPIError)] = [
    (401, "", .unauthorized),
    (404, "{\"error\":\"not_found\"}", .notFound),
    (409, "{\"error\":\"inbox_is_fixed\"}", .inboxIsFixed),
]

enum RemovalRequestKind: CaseIterable {
    case workspace
    case project

    func send(api: OwnerAPI, session: String, identifier: String) async throws {
        switch self {
        case .workspace: try await api.deleteWorkspace(session: session, workspaceIdentifier: identifier)
        case .project: try await api.deleteProject(session: session, projectIdentifier: identifier)
        }
    }
}

extension OwnerAPITests {
    @Test func renameWorkspacePatchesTheWorkspace() async throws {
        let workspaceIdentifier = UUID().uuidString.lowercased()
        let inbox = OwnerFixtures.projectJSON(identifier: projectIdentifier, name: "Inbox", isInbox: true)
        let body = "{\"workspace\":\(OwnerFixtures.workspaceJSON(identifier: workspaceIdentifier, name: "Acme Inc", projects: [inbox]))}"
        let workspace = try await api(answering: .response(status: 200, body: body))
            .renameWorkspace(session: session, workspaceIdentifier: workspaceIdentifier, name: "Acme Inc")
        try expectOnlyRequest(
            ExpectedRequest(method: "PATCH", path: "/owner/workspaces/\(workspaceIdentifier)", session: session, body: ["name": "Acme Inc"])
        )
        #expect(workspace.name == "Acme Inc")
    }

    @Test func deleteWorkspaceDeletesTheWorkspaceAndReadsNoBody() async throws {
        let workspaceIdentifier = UUID().uuidString.lowercased()
        try await api(answering: .response(status: 204, body: ""))
            .deleteWorkspace(session: session, workspaceIdentifier: workspaceIdentifier)
        try expectOnlyRequest(ExpectedRequest(method: "DELETE", path: "/owner/workspaces/\(workspaceIdentifier)", session: session, body: nil))
    }

    @Test func deleteProjectDeletesTheProjectAndReadsNoBody() async throws {
        try await api(answering: .response(status: 204, body: ""))
            .deleteProject(session: session, projectIdentifier: projectIdentifier)
        try expectOnlyRequest(ExpectedRequest(method: "DELETE", path: "/owner/projects/\(projectIdentifier)", session: session, body: nil))
    }

    @Test(arguments: RemovalRequestKind.allCases, removalFailures)
    func mapsARemovalFailureAsTheOtherCalls(kind: RemovalRequestKind, failure: (Int, String, OwnerAPIError)) async throws {
        let (status, body, expected) = failure
        let api = try api(answering: .response(status: status, body: body))
        await #expect(throws: expected) {
            try await kind.send(api: api, session: session, identifier: projectIdentifier)
        }
    }
}
