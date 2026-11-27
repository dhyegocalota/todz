import Foundation
import Observation

// NB ADR 0110: with the switch on, a session starts locked, shows only the current workspace and asks the Mac owner before any other.
@MainActor @Observable public final class WorkspaceLock {
    public private(set) var isEnabled: Bool
    public private(set) var isUnlocked = false
    public private(set) var timeout: WorkspaceLockTimeout
    public private(set) var isConfirmationFailed = false
    public private(set) var lastRelockTrigger: RelockTrigger?
    @ObservationIgnored private var lastInput: Date
    @ObservationIgnored private var authentication: Task<DeviceOwnerAuthentication, Never>?
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

    public func requiresAuthentication(for action: WorkspaceLockAction, current: String?) -> Bool {
        guard isLocked else { return false }
        guard case let .showWorkspaces(identifiers) = action, let current else { return true }
        return !identifiers.subtracting([current]).isEmpty
    }

    public func authorize(_ action: WorkspaceLockAction, current: String?) async -> Bool {
        guard requiresAuthentication(for: action, current: current) else { return true }
        let isTurningOffWithNoPassword = action == .turnOff && availability == .passcodeNotSet
        guard !isTurningOffWithNoPassword else { return true }
        isConfirmationFailed = availability != .available
        guard availability == .available else { return false }
        let result = await runningAuthentication(for: action).value
        authentication = nil
        isConfirmationFailed = result == .failed
        guard result == .confirmed else { return false }
        unlock()
        return true
    }

    private func runningAuthentication(for action: WorkspaceLockAction) -> Task<DeviceOwnerAuthentication, Never> {
        if let authentication { return authentication }
        let started = Task { await authenticator.authenticate(for: action) }
        authentication = started
        return started
    }

    public func turnOn() {
        preference.store(isOn: true)
        isEnabled = true
        isUnlocked = false
    }

    public func turnOff(current: String?) async -> Bool {
        guard await authorize(.turnOff, current: current) else { return false }
        preference.store(isOn: false)
        isEnabled = false
        isUnlocked = false
        return true
    }

    public func set(timeout: WorkspaceLockTimeout, current: String?) async -> Bool {
        guard await authorize(.changeTimeout, current: current) else { return false }
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

    public func noteInput() {
        lastInput = now()
    }

    @discardableResult
    public func relockIfIdle() -> Bool {
        let isIdle = now().timeIntervalSince(lastInput) >= timeout.seconds
        guard isIdle else { return false }
        return relock(because: .idle)
    }

    public func presented(_ workspaces: [Workspace], current: String?) -> [PresentedWorkspace] {
        workspaces.map { workspace in
            guard isLocked(workspaceIdentifier: workspace.identifier, current: current) else { return .visible(workspace) }
            return .locked(identifier: workspace.identifier)
        }
    }

    public func isLocked(workspaceIdentifier: String, current: String?) -> Bool {
        isLocked && workspaceIdentifier != current
    }

    public func visible(_ workspaces: [Workspace], current: String?) -> [Workspace] {
        guard isLocked else { return workspaces }
        let currentWorkspace = workspaces.first { $0.identifier == current }
        guard let shown = currentWorkspace ?? workspaces.first else { return [] }
        return [shown]
    }

    private func unlock() {
        isUnlocked = true
        lastInput = now()
    }
}
