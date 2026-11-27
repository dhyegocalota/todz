import Foundation
@testable import TodzKit

enum ConnectedAppFixtures {
    static let projectIdentifier = "5d0f4f0e-7a43-4c63-9a53-0b9b0d2a7c11"
    static let projectName = "Website"
    static let lastUsedAtMilliseconds: Int64 = 1_795_000_600_000

    static func projectScopedJSON(identifier: String) -> String {
        """
        {"id":"\(identifier)","client_name":"Claude Code","redirect_host":"127.0.0.1","scope":"project",\
        "project_id":"\(projectIdentifier)","project_name":"\(projectName)",\
        "created_at":\(OwnerFixtures.createdAtMilliseconds),"last_used_at":\(lastUsedAtMilliseconds)}
        """
    }

    static func ownerScopedJSON(identifier: String) -> String {
        """
        {"id":"\(identifier)","client_name":"Cursor","redirect_host":"localhost","scope":"owner",\
        "project_id":null,"project_name":null,\
        "created_at":\(OwnerFixtures.createdAtMilliseconds),"last_used_at":\(OwnerFixtures.createdAtMilliseconds)}
        """
    }

    static func projectScoped(identifier: String, projectIdentifier: String = projectIdentifier) -> ConnectedApp {
        ConnectedApp(
            identifier: identifier,
            clientName: "Claude Code",
            redirectHost: "127.0.0.1",
            scope: .project(identifier: projectIdentifier, name: projectName),
            createdAt: OwnerFixtures.date(milliseconds: OwnerFixtures.createdAtMilliseconds),
            lastUsedAt: OwnerFixtures.date(milliseconds: lastUsedAtMilliseconds)
        )
    }

    static func ownerScoped(identifier: String) -> ConnectedApp {
        ConnectedApp(
            identifier: identifier,
            clientName: "Cursor",
            redirectHost: "localhost",
            scope: .owner,
            createdAt: OwnerFixtures.date(milliseconds: OwnerFixtures.createdAtMilliseconds),
            lastUsedAt: OwnerFixtures.date(milliseconds: OwnerFixtures.createdAtMilliseconds)
        )
    }

    static func connectedApp(identifier: String, createdAtMilliseconds: Int64) -> ConnectedApp {
        ConnectedApp(
            identifier: identifier,
            clientName: "Codex",
            redirectHost: "127.0.0.1",
            scope: .owner,
            createdAt: OwnerFixtures.date(milliseconds: createdAtMilliseconds),
            lastUsedAt: OwnerFixtures.date(milliseconds: OwnerFixtures.createdAtMilliseconds)
        )
    }
}
