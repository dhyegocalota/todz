import SwiftUI
import TodzKit

private let firstNumber = 1

extension WorkspaceShortcuts {
    static func keyboardShortcut(number: Int) -> KeyboardShortcut? {
        guard (firstNumber...count).contains(number) else { return nil }
        return KeyboardShortcut(KeyEquivalent(Character(String(number))))
    }
}
