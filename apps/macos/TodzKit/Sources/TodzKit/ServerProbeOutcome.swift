public typealias ServerProbe = @Sendable (ServerAddress) async -> ServerProbeOutcome

public enum ServerProbeOutcome: Equatable, Sendable {
    case matches
    case answersAs(origin: String)
    case notTodz
    case unreachable

    public static func of(answer: ServerHealthAnswer, typedAddress: ServerAddress) -> ServerProbeOutcome {
        guard case let .todz(origin, _) = answer else { return .notTodz }
        guard case let .success(answered) = ServerAddress.checked(text: origin) else { return .notTodz }
        guard answered == typedAddress else { return .answersAs(origin: answered.origin) }
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
