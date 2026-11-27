import SwiftUI
import TodzKit

private let lockedSymbol = "lock.fill"

struct LockedWorkspaceRow: View {
    var body: some View {
        Label(WorkspaceLockCopy.lockedWorkspace, systemImage: lockedSymbol)
            .foregroundStyle(.secondary)
            .accessibilityHint(WorkspaceLockCopy.lockedRowHint)
    }
}

struct PresentedWorkspaceLabel: View {
    let presented: PresentedWorkspace

    var body: some View {
        switch presented {
        case let .visible(workspace): Text(workspace.name)
        case .locked: LockedWorkspaceRow()
        }
    }
}
