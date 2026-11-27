import TodzKit

enum VersionCopy {
    static var download: String { Localized.text("Download") }
    static var downloadLabel: String { Localized.text("Download todz") }
    static let downloadAddress = "https://todz.app"
    private static let separator = " · "
    private static var compatibleStatus: String { Localized.text("Compatible") }
    private static var updateNeededStatus: String { Localized.text("Update todz to keep syncing") }
    private static var behindStatus: String { Localized.text("Server needs an update") }
    private static var olderServer: String { Localized.text("Server older") }
    private static var behindTooltip: String { Localized.text("This server is older than this app expects. Whoever runs it can update it.") }
    private static let noTooltip = ""
    private static var updateNeededTooltipWithoutMinimum: String { Localized.text("This server needs a newer todz.") }

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
        case let .compatible(_, server): Localized.text("Server build \(server)")
        case let .updateNeeded(_, _, minimum): updateNeededTooltip(minimum)
        case .serverBehind: behindTooltip
        case .serverUnknown: noTooltip
        }
    }

    static func accessibilityLabel(_ compatibility: VersionCompatibility) -> String {
        switch compatibility {
        case let .compatible(app, server): Localized.text("todz \(app) and server \(ServerStamp.date(of: server)) work together.")
        case let .updateNeeded(app, _, _): Localized.text("todz \(app) is too old for this server. Update todz to keep syncing.")
        case let .serverBehind(app, _): Localized.text("The server is older than todz \(app) expects. It needs an update.")
        case let .serverUnknown(app): Localized.text("todz \(app).")
        }
    }

    private static func updateNeededTooltip(_ minimum: String?) -> String {
        guard let minimum else { return updateNeededTooltipWithoutMinimum }
        return Localized.text("This server needs todz \(minimum) or later.")
    }

    private static func appPart(_ app: String) -> String {
        Localized.text("App \(app)")
    }

    private static func serverPart(_ stamp: String) -> String {
        Localized.text("Server \(ServerStamp.date(of: stamp))")
    }

    private static func behindServerPart(_ stamp: String?) -> String {
        guard let stamp else { return olderServer }
        return serverPart(stamp)
    }

    private static func joined(_ parts: [String?]) -> String {
        parts.compactMap { $0 }.joined(separator: separator)
    }
}
