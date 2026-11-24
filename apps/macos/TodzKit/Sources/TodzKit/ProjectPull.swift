enum ProjectPull: Sendable {
    case loaded(projectIdentifier: String, changes: ProjectChanges)
    case notFound(projectIdentifier: String)
    case unreachable(projectIdentifier: String)
    case failed(projectIdentifier: String)

    static func pulling(feed: ProjectFeed, session: String, projectIdentifier: String, cursor: Int) async throws -> ProjectPull {
        do {
            let changes = try await feed.pull(session: session, projectIdentifier: projectIdentifier, cursor: cursor)
            return .loaded(projectIdentifier: projectIdentifier, changes: changes)
        } catch OwnerAPIError.unauthorized {
            throw OwnerAPIError.unauthorized
        } catch OwnerAPIError.notFound {
            return .notFound(projectIdentifier: projectIdentifier)
        } catch OwnerAPIError.unreachable {
            return .unreachable(projectIdentifier: projectIdentifier)
        } catch {
            return .failed(projectIdentifier: projectIdentifier)
        }
    }

    var failedProjectIdentifier: String? {
        switch self {
        case .loaded, .notFound: nil
        case let .unreachable(projectIdentifier), let .failed(projectIdentifier): projectIdentifier
        }
    }

    var isUnreachable: Bool {
        guard case .unreachable = self else { return false }
        return true
    }
}
