@testable import TodzKit

@MainActor final class FakeAuthenticator: DeviceOwnerAuthenticator {
    var isOwnerAuthenticated = true
    var isCancelling = false
    var isHolding = false
    var availability = DeviceOwnerAvailability.available
    private(set) var asked: [WorkspaceLockAction] = []
    private var hold: CheckedContinuation<Void, Never>?

    nonisolated var currentAvailability: DeviceOwnerAvailability {
        MainActor.assumeIsolated { availability }
    }

    func authenticate(for action: WorkspaceLockAction) async -> DeviceOwnerAuthentication {
        asked.append(action)
        if isHolding { await withCheckedContinuation { hold = $0 } }
        if isOwnerAuthenticated { return .confirmed }
        return isCancelling ? .cancelled : .failed
    }

    func release() {
        isHolding = false
        hold?.resume()
        hold = nil
    }
}
