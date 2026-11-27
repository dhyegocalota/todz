import LocalAuthentication
import TodzKit

private let cancellationCodes: Set<LAError.Code> = [.userCancel, .systemCancel, .appCancel]

// NB ADR 0110: Touch ID, else the Mac password, through the system's own sheet; todz draws no password field.
struct MacOwnerAuthenticator: DeviceOwnerAuthenticator {
    var canAuthenticate: Bool {
        LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
    }

    func authenticate(for action: WorkspaceLockAction) async -> DeviceOwnerAuthentication {
        do {
            _ = try await LAContext().evaluatePolicy(.deviceOwnerAuthentication, localizedReason: WorkspaceLockCopy.reason(for: action))
            return .confirmed
        } catch let error as LAError where cancellationCodes.contains(error.code) {
            return .cancelled
        } catch {
            return .failed
        }
    }
}
