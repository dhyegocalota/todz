public struct MenuBarNotice: Equatable, Sendable {
    public enum Strip: Equatable, Sendable {
        case banner
        case offline
        case none
    }

    public let strip: Strip
    public let showsUpdateDot: Bool

    public init(hasBanner: Bool, isOffline: Bool, hasUpdateNote: Bool) {
        showsUpdateDot = hasUpdateNote
        guard !hasBanner else {
            strip = .banner
            return
        }
        strip = isOffline ? .offline : .none
    }
}
