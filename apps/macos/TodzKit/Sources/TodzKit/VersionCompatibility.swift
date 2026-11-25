public let minimumServerVersion = "2026.11.25"

private func isVersion(_ text: String, below limit: String) -> Bool {
    guard let version = DottedVersion(text: text), let limitVersion = DottedVersion(text: limit) else { return false }
    return version < limitVersion
}

public enum VersionCompatibility: Equatable, Sendable {
    case compatible(app: String, server: String)
    case updateNeeded(app: String, server: String?, minimum: String)
    case serverBehind(app: String, server: String?)
    case serverUnknown(app: String)

    static func of(app: String, server: ServerVersions?, refusal: String?) -> VersionCompatibility {
        if let refusal { return .updateNeeded(app: app, server: server?.server, minimum: refusal) }
        guard let server else { return .serverUnknown(app: app) }
        if let minimum = server.minimumApp, isVersion(app, below: minimum) { return .updateNeeded(app: app, server: server.server, minimum: minimum) }
        guard let stamp = server.server, DottedVersion(text: ServerStamp.date(of: stamp)) != nil else { return .serverBehind(app: app, server: nil) }
        guard !isVersion(ServerStamp.date(of: stamp), below: minimumServerVersion) else { return .serverBehind(app: app, server: stamp) }
        return .compatible(app: app, server: stamp)
    }
}
