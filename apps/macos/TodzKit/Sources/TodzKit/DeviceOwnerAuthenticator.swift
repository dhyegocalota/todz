public enum DeviceOwnerAuthentication: Sendable {
    case confirmed
    case cancelled
    case failed
}

public protocol DeviceOwnerAuthenticator: Sendable {
    var canAuthenticate: Bool { get }
    func authenticate(for action: WorkspaceLockAction) async -> DeviceOwnerAuthentication
}
