public enum ServerSwitchFailure: Equatable, Sendable {
    case eraseFailed
}

public enum ServerSwitchState: Equatable, Sendable {
    case idle
    case checking
    case refused(ServerAddressIssue)
    case notTodz
    case answersAs(origin: String)
    case alreadyInUse
    case confirming(losing: Int, signedIn: Bool)
    case switching
    case switched(server: String)
    case failed(ServerSwitchFailure)
}

public struct ServerSwitchFlow: Equatable, Sendable {
    public private(set) var state = ServerSwitchState.idle

    public init() {}

    public mutating func submit(text: String, serverURL: ServerAddress) -> ServerAddress? {
        preconditionFailure("ServerSwitchFlow.submit is not implemented")
    }

    public mutating func receive(outcome: ServerProbeOutcome, isSignedIn: Bool, waitingChanges: Int) {
        preconditionFailure("ServerSwitchFlow.receive is not implemented")
    }

    public mutating func useDefault(isSignedIn: Bool, waitingChanges: Int) {
        preconditionFailure("ServerSwitchFlow.useDefault is not implemented")
    }

    public mutating func confirm() {
        preconditionFailure("ServerSwitchFlow.confirm is not implemented")
    }

    public mutating func decline() {
        preconditionFailure("ServerSwitchFlow.decline is not implemented")
    }

    public mutating func cancel() {
        preconditionFailure("ServerSwitchFlow.cancel is not implemented")
    }

    public mutating func reset() {
        preconditionFailure("ServerSwitchFlow.reset is not implemented")
    }

    public mutating func finish(isSwitched: Bool, server: ServerAddress) {
        preconditionFailure("ServerSwitchFlow.finish is not implemented")
    }
}
