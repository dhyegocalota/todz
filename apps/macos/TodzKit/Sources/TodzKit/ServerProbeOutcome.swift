public typealias ServerProbe = @Sendable (ServerAddress) async -> ServerProbeOutcome

public enum ServerProbeOutcome: Equatable, Sendable {
    case matches
    case answersAs(origin: String)
    case notTodz
    case unreachable

    public static func of(answer: ServerHealthAnswer, typedAddress: ServerAddress) -> ServerProbeOutcome {
        preconditionFailure("ServerProbeOutcome.of is not implemented")
    }
}

extension OwnerAPI {
    public func probe(typedAddress: ServerAddress) async -> ServerProbeOutcome {
        preconditionFailure("OwnerAPI.probe is not implemented")
    }
}
