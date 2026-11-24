enum ProjectPull: Sendable {
    case loaded(projectIdentifier: String, tasks: [TaskRecord])
    case failed(projectIdentifier: String)

    static func pulling(feed: ProjectFeed, session: String, projectIdentifier: String) async throws -> ProjectPull {
        do {
            let tasks = try await feed.pull(session: session, projectIdentifier: projectIdentifier, cursor: ProjectFeed.firstCursor)
            return .loaded(projectIdentifier: projectIdentifier, tasks: tasks)
        } catch OwnerAPIError.unauthorized {
            throw OwnerAPIError.unauthorized
        } catch {
            return .failed(projectIdentifier: projectIdentifier)
        }
    }
}
