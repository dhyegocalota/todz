import SwiftUI
import TodzKit

private let columnWidth: CGFloat = 320
private let noName = ""

struct FirstWorkspaceScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @State private var name = noName
    @FocusState private var isNameFocused: Bool

    var body: some View {
        CenteredColumn(width: columnWidth) {
            Text(FirstWorkspaceCopy.title)
                .font(.title)
                .bold()
            Text(FirstWorkspaceCopy.body)
                .foregroundStyle(.secondary)
            TextField(FirstWorkspaceCopy.namePlaceholder, text: $name)
                .textFieldStyle(.roundedBorder)
                .focused($isNameFocused)
                .disabled(isCreating)
                .onSubmit(create)
            if let issue = NameIssue.shown(name: name, serverIssue: model.ruleIssues[.newWorkspace]) {
                Text(issue.copy)
                    .foregroundStyle(.red)
            }
            if let banner = model.banner {
                Text(banner.title)
                    .foregroundStyle(banner.lineStyle)
                BannerActionButton()
            }
            if isCreating {
                ProgressView()
                    .controlSize(.small)
            }
            if !isCreating {
                Button(FirstWorkspaceCopy.create, action: create)
                    .buttonStyle(.borderedProminent)
                    .keyboardShortcut(.defaultAction)
                    .disabled(because: NameIssue.disabledReason(name: name))
            }
            Button(FirstWorkspaceCopy.signOut) {
                windowState.requestSignOut(model: model)
            }
            .buttonStyle(.link)
        }
        .multilineTextAlignment(.center)
        .task { isNameFocused = true }
    }

    private var isCreating: Bool {
        model.writesInFlight.contains(.newWorkspace)
    }

    private func create() {
        guard NameIssue.disabledReason(name: name) == nil, !isCreating else { return }
        Task { await model.createWorkspace(name: name) }
    }
}
