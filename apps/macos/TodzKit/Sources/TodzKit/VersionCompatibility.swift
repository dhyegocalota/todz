public enum VersionCompatibility: Equatable, Sendable {
    case compatible(app: String, server: String)
    case updateNeeded(app: String, server: String?, minimum: String)
    case serverBehind(app: String, server: String?)
    case serverUnknown(app: String)

    static func of(app: String, server: ServerVersions?, refusal: String?) -> VersionCompatibility {
        fatalError("VersionCompatibility.of is not implemented")
    }
}
