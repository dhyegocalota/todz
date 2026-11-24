enum SendOutcome: Equatable, Sendable {
    case refused
    case unreachable
    case unexpected
    case sessionGone

    static func of(_ error: any Error) -> SendOutcome {
        fatalError("SendOutcome.of is not implemented")
    }
}
