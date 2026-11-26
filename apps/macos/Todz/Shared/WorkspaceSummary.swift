import SwiftUI
import TodzKit

struct WorkspaceSummary: View {
    let workspace: Workspace

    var body: some View {
        VStack(alignment: .leading) {
            Text(workspace.name)
                .lineLimit(1)
            Text(WorkspacePickerCopy.projectCount(count: workspace.projectCount))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
