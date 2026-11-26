import SwiftUI
import TodzKit

@MainActor @Observable final class WorkspaceShortcutController {
    private(set) var globalChords: GlobalWorkspaceChords
    private(set) var unavailableActions: Set<WorkspaceAction> = []
    private let model: AppModel
    private let preference: WorkspaceShortcutsPreference
    private let hotKeys: WorkspaceHotKeys

    init(model: AppModel, preference: WorkspaceShortcutsPreference, onUsed: @escaping () -> Void) {
        self.model = model
        self.preference = preference
        globalChords = preference.globalChords
        hotKeys = WorkspaceHotKeys(onAction: { action in
            onUsed()
            Task { await model.switchWorkspace(action: action) }
        })
    }

    func start() {
        registerHotKeys()
        observeEligibility()
    }

    func stop() {
        hotKeys.unregister()
    }

    func registerHotKeys() {
        let isEligible = WorkspaceShortcuts.shouldRegister(phase: model.phase, workspaceCount: model.workspaces.count, isGlobalOn: preference.isGlobalOn)
        guard isEligible else {
            hotKeys.unregister()
            unavailableActions = []
            return
        }
        let systemEntries = Self.systemHotKeyEntries()
        let plan = GlobalChordPlan(chords: globalChords, isHeldBySystem: { SymbolicHotKeys.holds($0, in: systemEntries) })
        unavailableActions = plan.heldBySystem.union(hotKeys.register(plan.registrations))
    }

    func suspendHotKeys() {
        hotKeys.unregister()
    }

    func shortcut(for action: WorkspaceAction) -> KeyboardShortcut? {
        action.inAppChord?.keyboardShortcut
    }

    func isInUse(_ action: WorkspaceAction) -> Bool {
        unavailableActions.contains(action)
    }

    func rebind(_ action: WorkspaceAction, to chord: KeyChord) -> RebindRefusal? {
        switch globalChords.rebinding(action, to: chord) {
        case let .failure(refusal): return refusal
        case let .success(rebound):
            globalChords = rebound
            preference.store(rebound)
            return nil
        }
    }

    private static func systemHotKeyEntries() -> [String: Any] {
        let stored = CFPreferencesCopyAppValue(SymbolicHotKeys.entriesKey as CFString, SymbolicHotKeys.domainName as CFString)
        guard let entries = stored as? [String: Any] else { return [:] }
        return entries
    }

    private func observeEligibility() {
        withObservationTracking {
            _ = model.phase
            _ = model.workspaces
        } onChange: {
            Task { @MainActor in
                self.registerHotKeys()
                self.observeEligibility()
            }
        }
    }
}
