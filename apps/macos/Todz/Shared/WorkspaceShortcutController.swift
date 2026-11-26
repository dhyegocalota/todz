import SwiftUI
import TodzKit

@MainActor @Observable final class WorkspaceShortcutController {
    private(set) var bindings: WorkspaceBindings
    private let preference: WorkspaceShortcutsPreference
    private let hotKeys: WorkspaceHotKeys

    init(preference: WorkspaceShortcutsPreference, onAction: @escaping (WorkspaceAction) -> Void) {
        self.preference = preference
        bindings = preference.bindings
        hotKeys = WorkspaceHotKeys(onAction: onAction)
    }

    func start() {
        registerHotKeys()
    }

    func registerHotKeys() {
        guard preference.isGlobalOn else { return hotKeys.unregister() }
        hotKeys.register(bindings)
    }

    func shortcut(for action: WorkspaceAction) -> KeyboardShortcut? {
        bindings.chord(for: action)?.keyboardShortcut
    }

    func rebind(_ action: WorkspaceAction, to chord: KeyChord) -> RebindRefusal? {
        switch bindings.rebinding(action, to: chord) {
        case let .failure(refusal): return refusal
        case let .success(rebound):
            bindings = rebound
            preference.store(rebound)
            registerHotKeys()
            return nil
        }
    }
}
