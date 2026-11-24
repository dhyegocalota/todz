public struct ProjectFeed: Sendable {
    static let firstCursor = 0

    private let service: any OwnerService

    public init(service: any OwnerService) {
        self.service = service
    }

    public func pull(session: String, projectIdentifier: String, cursor: Int) async throws -> ProjectChanges {
        do {
            return try await changes(session: session, projectIdentifier: projectIdentifier, cursor: cursor, isFromStart: false)
        } catch OwnerAPIError.cursorAhead {
            return try await changes(session: session, projectIdentifier: projectIdentifier, cursor: Self.firstCursor, isFromStart: true)
        }
    }

    private func changes(session: String, projectIdentifier: String, cursor: Int, isFromStart: Bool) async throws -> ProjectChanges {
        try Task.checkCancellation()
        let page = try await service.readChanges(session: session, projectIdentifier: projectIdentifier, cursor: cursor)
        guard page.hasMore else { return ProjectChanges(tasks: page.tasks, cursor: page.cursor, isFromStart: isFromStart) }
        let rest = try await changes(session: session, projectIdentifier: projectIdentifier, cursor: page.cursor, isFromStart: isFromStart)
        return ProjectChanges(tasks: page.tasks + rest.tasks, cursor: rest.cursor, isFromStart: isFromStart)
    }
}
