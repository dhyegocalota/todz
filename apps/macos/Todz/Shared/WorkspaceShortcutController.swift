import SwiftUI
import TodzKit

@MainActor @Observable final class WorkspaceShortcutController {
    private(set) var globalChords: GlobalWorkspaceChords
    private(set) var globalAvailability: [WorkspaceAction: GlobalChordAvailability] = [:]
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
            globalAvailability = [:]
            return
        }
        globalAvailability = hotKeys.register(GlobalChordPlan(chords: globalChords).registrations)
    }

    func suspendHotKeys() {
        hotKeys.unregister()
    }

    func shortcut(for action: WorkspaceAction) -> KeyboardShortcut? {
        action.inAppChord?.keyboardShortcut
    }

    func availability(of action: WorkspaceAction) -> GlobalChordAvailability? {
        globalAvailability[action]
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
