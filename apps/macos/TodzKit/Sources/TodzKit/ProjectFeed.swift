public struct ProjectFeed: Sendable {
    private let service: any OwnerService

    public init(service: any OwnerService) {
        self.service = service
    }

    public func pull(session: String, projectIdentifier: String, cursor: Int) async throws -> [TaskRecord] {
        fatalError("ProjectFeed is not implemented")
    }
}
