import SwiftUI
import TodzKit

extension WorkspaceShortcuts {
    static func lastNumber(of workspaces: [Workspace]) -> Int {
        min(workspaces.count, count)
    }
}
