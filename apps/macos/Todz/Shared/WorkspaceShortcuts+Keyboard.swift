import SwiftUI
import TodzKit

private let firstNumber = 1

extension WorkspaceShortcuts {
    static func numbered(_ workspaces: [Workspace]) -> [(number: Int, workspace: Workspace)] {
        zip(firstNumber..., workspaces).map { (number: $0, workspace: $1) }
    }

    static func keyboardShortcut(number: Int) -> KeyboardShortcut? {
        guard (firstNumber...count).contains(number) else { return nil }
        return KeyboardShortcut(KeyEquivalent(Character(String(number))))
    }

    static func lastNumber(of workspaces: [Workspace]) -> Int {
        min(workspaces.count, count)
    }
}
