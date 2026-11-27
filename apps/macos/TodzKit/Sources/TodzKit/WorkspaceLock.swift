import Foundation
import Observation

// NB ADR 0128: with the switch on, a session starts locked, shows only the workspaces it kept and asks the Mac owner before any other.
@MainActor @Observable public final class WorkspaceLock {
    public private(set) var isEnabled: Bool
    public private(set) var isUnlocked = false
    public private(set) var timeout: WorkspaceLockTimeout
    public private(set) var isConfirmationFailed = false
    public private(set) var lastRelockTrigger: RelockTrigger?
    @ObservationIgnored private var lastInput: Date
    @ObservationIgnored private var authentication: (action: WorkspaceLockAction, task: Task<DeviceOwnerAuthentication, Never>)?
    @ObservationIgnored private let preference: WorkspaceLockPreference
    @ObservationIgnored private let authenticator: any DeviceOwnerAuthenticator
    @ObservationIgnored private let now: () -> Date

    public init(preference: WorkspaceLockPreference, authenticator: any DeviceOwnerAuthenticator, now: @escaping () -> Date = Date.init) {
        self.preference = preference
        self.authenticator = authenticator
        self.now = now
        isEnabled = preference.isOn
        timeout = preference.timeout
        lastInput = now()
    }

    public var isLocked: Bool {
        isEnabled && !isUnlocked
    }

    public var availability: DeviceOwnerAvailability {
        authenticator.currentAvailability
    }

    public func requiresAuthentication(for action: WorkspaceLockAction) -> Bool {
        guard isEnabled else { return false }
        let isWeakening = action == .turnOff || action == .changeTimeout
        return isWeakening || isLocked
    }

    public func authorize(_ action: WorkspaceLockAction) async -> Bool {
        guard requiresAuthentication(for: action) else { return true }
        let isTurningOffWithNoPassword = action == .turnOff && availability == .passcodeNotSet
        guard !isTurningOffWithNoPassword else { return true }
        isConfirmationFailed = availability != .available
        guard availability == .available else { return false }
        guard let running = runningAuthentication(for: action) else { return false }
        let result = await running.value
        authentication = nil
        isConfirmationFailed = result == .failed
        guard result == .confirmed else { return false }
        unlock()
        return true
    }

    private func runningAuthentication(for action: WorkspaceLockAction) -> Task<DeviceOwnerAuthentication, Never>? {
        if let authentication { return authentication.action == action ? authentication.task : nil }
        let started = Task { await authenticator.authenticate(for: action) }
        authentication = (action: action, task: started)
        return started
    }

    public func turnOn() {
        preference.store(isOn: true)
        isEnabled = true
        isUnlocked = false
    }

    public func turnOff() async -> Bool {
        guard await authorize(.turnOff) else { return false }
        preference.store(isOn: false)
        isEnabled = false
        isUnlocked = false
        return true
    }

    public func set(timeout: WorkspaceLockTimeout) async -> Bool {
        guard await authorize(.changeTimeout) else { return false }
        preference.store(timeout: timeout)
        self.timeout = timeout
        return true
    }

    @discardableResult
    public func relock(because trigger: RelockTrigger) -> Bool {
        guard isEnabled, isUnlocked else { return false }
        isUnlocked = false
        lastRelockTrigger = trigger
        return true
    }

    @discardableResult
    public func noteInput() -> Bool {
        guard !relockIfIdle() else { return true }
        lastInput = now()
        return false
    }

    @discardableResult
    public func relockIfIdle() -> Bool {
        let isIdle = now().timeIntervalSince(lastInput) >= timeout.seconds
        guard isIdle else { return false }
        return relock(because: .idle)
    }

    public func isLocked(workspaceIdentifier: String, kept: Set<String>) -> Bool {
        isLocked && !kept.contains(workspaceIdentifier)
    }

    public func visible(_ workspaces: [Workspace], kept: Set<String>) -> [Workspace] {
        guard isLocked else { return workspaces }
        return workspaces.filter { kept.contains($0.identifier) }
    }

    private func unlock() {
        isUnlocked = true
        lastInput = now()
    }
}
