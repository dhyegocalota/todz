import TodzKit

enum VersionCopy {
    static let download = "Download"
    static let downloadLabel = "Download todz"
    static let downloadAddress = "https://todz.app"
    private static let separator = " · "
    private static let compatibleStatus = "Compatible"
    private static let updateNeededStatus = "Update todz to keep syncing"
    private static let behindStatus = "Server needs an update"
    private static let olderServer = "Server older"
    private static let behindTooltip = "This server is older than this app expects. Whoever runs it can update it."
    private static let noTooltip = ""
    private static let updateNeededTooltipWithoutMinimum = "This server needs a newer todz."

    static func line(_ compatibility: VersionCompatibility) -> String {
        switch compatibility {
        case let .compatible(app, server): joined([appPart(app), serverPart(server), compatibleStatus])
        case let .updateNeeded(app, server, _): joined([appPart(app), server.map(serverPart), updateNeededStatus])
        case let .serverBehind(app, server): joined([appPart(app), behindServerPart(server), behindStatus])
        case let .serverUnknown(app): appPart(app)
        }
    }

    static func tooltip(_ compatibility: VersionCompatibility) -> String {
        switch compatibility {
        case let .compatible(_, server): "Server build \(server)"
        case let .updateNeeded(_, _, minimum): updateNeededTooltip(minimum)
        case .serverBehind: behindTooltip
        case .serverUnknown: noTooltip
        }
    }

    static func accessibilityLabel(_ compatibility: VersionCompatibility) -> String {
        switch compatibility {
        case let .compatible(app, server): "todz \(app) and server \(ServerStamp.date(of: server)) work together."
        case let .updateNeeded(app, _, _): "todz \(app) is too old for this server. \(updateNeededStatus)."
        case let .serverBehind(app, _): "The server is older than todz \(app) expects. It needs an update."
        case let .serverUnknown(app): "todz \(app)."
        }
    }

    private static func updateNeededTooltip(_ minimum: String?) -> String {
        guard let minimum else { return updateNeededTooltipWithoutMinimum }
        return "This server needs todz \(minimum) or later."
    }

    private static func appPart(_ app: String) -> String {
        "App \(app)"
    }

    private static func serverPart(_ stamp: String) -> String {
        "Server \(ServerStamp.date(of: stamp))"
    }

    private static func behindServerPart(_ stamp: String?) -> String {
        guard let stamp else { return olderServer }
        return serverPart(stamp)
    }

    private static func joined(_ parts: [String?]) -> String {
        parts.compactMap { $0 }.joined(separator: separator)
    }
}
