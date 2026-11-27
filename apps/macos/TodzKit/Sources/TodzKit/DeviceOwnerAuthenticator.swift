public enum DeviceOwnerAuthentication: Sendable {
    case confirmed
    case cancelled
    case failed
}

public enum DeviceOwnerAvailability: Sendable {
    case available
    case passcodeNotSet
    case unavailable
}

public protocol DeviceOwnerAuthenticator: Sendable {
    var currentAvailability: DeviceOwnerAvailability { get }
    func authenticate(for action: WorkspaceLockAction) async -> DeviceOwnerAuthentication
}
