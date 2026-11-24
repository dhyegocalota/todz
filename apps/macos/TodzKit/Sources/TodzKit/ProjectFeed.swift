private let firstCursor = 0

public struct ProjectFeed: Sendable {
    private let service: any OwnerService

    public init(service: any OwnerService) {
        self.service = service
    }

    public func pull(session: String, projectIdentifier: String, cursor: Int) async throws -> [TaskRecord] {
        do {
            return try await tasks(session: session, projectIdentifier: projectIdentifier, cursor: cursor)
        } catch OwnerAPIError.cursorAhead {
            return try await tasks(session: session, projectIdentifier: projectIdentifier, cursor: firstCursor)
        }
    }

    private func tasks(session: String, projectIdentifier: String, cursor: Int) async throws -> [TaskRecord] {
        try Task.checkCancellation()
        let page = try await service.readChanges(session: session, projectIdentifier: projectIdentifier, cursor: cursor)
        guard page.hasMore else { return page.tasks }
        return page.tasks + (try await tasks(session: session, projectIdentifier: projectIdentifier, cursor: page.cursor))
    }
}
