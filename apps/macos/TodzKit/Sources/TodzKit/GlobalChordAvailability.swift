public enum GlobalChordAvailability: Equatable, Sendable {
    case available
    case inUse
    case failed

    private static let succeededStatus: Int32 = 0
    private static let existsStatus: Int32 = -9878

    public static func registering(status: Int32) -> GlobalChordAvailability {
        switch status {
        case succeededStatus: .available
        case existsStatus: .inUse
        default: .failed
        }
    }
}
