import SwiftUI
import TodzKit

extension WorkspaceShortcuts {
    static func keyboardShortcut(number: Int) -> KeyboardShortcut? {
        guard numbers.contains(number) else { return nil }
        return KeyboardShortcut(KeyEquivalent(Character(String(number))))
    }
}
