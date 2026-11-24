public enum KeyFailure: Equatable, Sendable {
    case unreachable
    case unexpected

    init(_ error: any Error) {
        let isUnreachable = (error as? OwnerAPIError) == .unreachable
        self = isUnreachable ? .unreachable : .unexpected
    }
}
