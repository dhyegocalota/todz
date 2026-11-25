public typealias ServerProbe = @Sendable (ServerAddress) async -> ServerProbeOutcome

public enum ServerProbeOutcome: Equatable, Sendable {
    case matches
    case answersAs(origin: String)
    case notTodz
    case unreachable

    public static func of(answer: ServerHealthAnswer, typedAddress: ServerAddress) -> ServerProbeOutcome {
        guard case let .todz(origin) = answer else { return .notTodz }
        guard origin == typedAddress.origin else { return .answersAs(origin: origin) }
        return .matches
    }
}

extension OwnerAPI {
    public func probe(typedAddress: ServerAddress) async -> ServerProbeOutcome {
        do {
            return try await .of(answer: health(), typedAddress: typedAddress)
        } catch {
            return .unreachable
        }
    }
}
