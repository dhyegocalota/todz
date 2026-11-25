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

    private var isBusy: Bool {
        switch state {
        case .checking, .confirming, .switching: true
        default: false
        }
    }

    public mutating func submit(text: String, serverURL: ServerAddress) -> ServerAddress? {
        guard !isBusy else { return nil }
        switch ServerAddress.checked(text: text) {
        case let .failure(issue):
            state = .refused(issue)
            return nil
        case let .success(address):
            guard address != serverURL else {
                state = .alreadyInUse
                return nil
            }
            state = .checking
            return address
        }
    }

    public mutating func receive(outcome: ServerProbeOutcome, isSignedIn: Bool, waitingChanges: Int) {
        guard state == .checking else { return }
        switch outcome {
        case .matches: proceed(isSignedIn: isSignedIn, waitingChanges: waitingChanges)
        case let .answersAs(origin): state = .answersAs(origin: origin)
        case .notTodz, .unreachable: state = .notTodz
        }
    }

    public mutating func useDefault(isSignedIn: Bool, waitingChanges: Int) {
        guard !isBusy else { return }
        proceed(isSignedIn: isSignedIn, waitingChanges: waitingChanges)
    }

    public mutating func confirm() {
        guard case .confirming = state else { return }
        state = .switching
    }

    public mutating func decline() {
        guard case .confirming = state else { return }
        state = .idle
    }

    public mutating func cancel() {
        guard state == .checking else { return }
        state = .idle
    }

    public mutating func reset() {
        guard !isBusy else { return }
        state = .idle
    }

    public mutating func finish(isSwitched: Bool, server: ServerAddress) {
        guard state == .switching else { return }
        state = isSwitched ? .switched(server: ServerName.of(address: server)) : .failed(.eraseFailed)
    }

    private mutating func proceed(isSignedIn: Bool, waitingChanges: Int) {
        let isLosingSomething = isSignedIn || waitingChanges > 0
        state = isLosingSomething ? .confirming(losing: waitingChanges, signedIn: isSignedIn) : .switching
    }
}
