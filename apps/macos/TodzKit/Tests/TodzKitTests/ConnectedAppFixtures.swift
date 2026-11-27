import Foundation
@testable import TodzKit

enum ConnectedAppFixtures {
    static let projectIdentifier = "5d0f4f0e-7a43-4c63-9a53-0b9b0d2a7c11"
    static let projectName = "Website"
    static let workspaceIdentifier = "acme"
    static let workspaceName = "Acme"
    static let lastUsedAtMilliseconds: Int64 = 1_795_000_600_000

    static func projectScopedJSON(identifier: String) -> String {
        """
        {"id":"\(identifier)","client_name":"Claude Code","redirect_host":"127.0.0.1","scope":"project",\
        "project_id":"\(projectIdentifier)","project_name":"\(projectName)",\
        "scopes":[{"kind":"project","project_id":"\(projectIdentifier)","project_name":"\(projectName)","workspace_id":"\(workspaceIdentifier)","workspace_name":"\(workspaceName)"}],\
        "created_at":\(OwnerFixtures.createdAtMilliseconds),"last_used_at":\(lastUsedAtMilliseconds)}
        """
    }

    static func ownerScopedJSON(identifier: String) -> String {
        """
        {"id":"\(identifier)","client_name":"Cursor","redirect_host":"localhost","scope":"owner",\
        "project_id":null,"project_name":null,"scopes":[{"kind":"account"}],\
        "created_at":\(OwnerFixtures.createdAtMilliseconds),"last_used_at":\(OwnerFixtures.createdAtMilliseconds)}
        """
    }

    static func selectionScopedJSON(identifier: String) -> String {
        """
        {"id":"\(identifier)","client_name":"Claude","redirect_host":"claude.ai","scope":"selection",\
        "project_id":null,"project_name":null,\
        "scopes":[{"kind":"workspace","workspace_id":"w1","workspace_name":"Thrifty Traveler"},\
        {"kind":"project","project_id":"p1","project_name":"Inbox","workspace_id":"w2","workspace_name":"Personal"}],\
        "created_at":\(OwnerFixtures.createdAtMilliseconds),"last_used_at":\(lastUsedAtMilliseconds)}
        """
    }

    static func projectScoped(identifier: String, projectIdentifier: String = projectIdentifier, workspaceIdentifier: String = workspaceIdentifier) -> ConnectedApp {
        app(
            identifier: identifier,
            clientName: "Claude Code",
            redirectHost: "127.0.0.1",
            scopes: [.project(identifier: projectIdentifier, name: projectName, workspaceIdentifier: workspaceIdentifier, workspaceName: workspaceName)],
            lastUsedAtMilliseconds: lastUsedAtMilliseconds
        )
    }

    static func ownerScoped(identifier: String) -> ConnectedApp {
        app(identifier: identifier, clientName: "Cursor", redirectHost: "localhost", scopes: [.account], lastUsedAtMilliseconds: OwnerFixtures.createdAtMilliseconds)
    }

    static func selectionScoped(identifier: String) -> ConnectedApp {
        app(
            identifier: identifier,
            clientName: "Claude",
            redirectHost: "claude.ai",
            scopes: [
                .workspace(identifier: "w1", name: "Thrifty Traveler"),
                .project(identifier: "p1", name: "Inbox", workspaceIdentifier: "w2", workspaceName: "Personal"),
            ],
            lastUsedAtMilliseconds: lastUsedAtMilliseconds
        )
    }

    static func connectedApp(identifier: String, createdAtMilliseconds: Int64) -> ConnectedApp {
        ConnectedApp(
            identifier: identifier,
            clientName: "Codex",
            redirectHost: "127.0.0.1",
            scopes: [.account],
            createdAt: OwnerFixtures.date(milliseconds: createdAtMilliseconds),
            lastUsedAt: OwnerFixtures.date(milliseconds: OwnerFixtures.createdAtMilliseconds)
        )
    }

    private static func app(identifier: String, clientName: String, redirectHost: String, scopes: [ConnectedScope], lastUsedAtMilliseconds: Int64) -> ConnectedApp {
        ConnectedApp(
            identifier: identifier,
            clientName: clientName,
            redirectHost: redirectHost,
            scopes: scopes,
            createdAt: OwnerFixtures.date(milliseconds: OwnerFixtures.createdAtMilliseconds),
            lastUsedAt: OwnerFixtures.date(milliseconds: lastUsedAtMilliseconds)
        )
    }
}
