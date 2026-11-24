enum ProjectPull: Sendable {
    case loaded(projectIdentifier: String, tasks: [TaskRecord])
    case unreachable(projectIdentifier: String)
    case failed(projectIdentifier: String)

    static func pulling(feed: ProjectFeed, session: String, projectIdentifier: String) async throws -> ProjectPull {
        do {
            let tasks = try await feed.pull(session: session, projectIdentifier: projectIdentifier, cursor: ProjectFeed.firstCursor)
            return .loaded(projectIdentifier: projectIdentifier, tasks: tasks)
        } catch OwnerAPIError.unauthorized {
            throw OwnerAPIError.unauthorized
        } catch OwnerAPIError.unreachable {
            return .unreachable(projectIdentifier: projectIdentifier)
        } catch {
            return .failed(projectIdentifier: projectIdentifier)
        }
    }

    var failedProjectIdentifier: String? {
        switch self {
        case .loaded: nil
        case let .unreachable(projectIdentifier), let .failed(projectIdentifier): projectIdentifier
        }
    }

    var isUnreachable: Bool {
        guard case .unreachable = self else { return false }
        return true
    }
}
