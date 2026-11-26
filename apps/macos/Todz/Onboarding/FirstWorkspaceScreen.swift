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
        CenteredColumn {
            FormPanel(width: columnWidth) {
                Text(FirstWorkspaceCopy.title)
                    .font(.title)
                    .bold()
                Text(FirstWorkspaceCopy.body)
                    .foregroundStyle(.secondary)
                FormField(label: FirstWorkspaceCopy.namePlaceholder, prompt: FirstWorkspaceCopy.namePlaceholder, text: $name, issue: shownIssue?.copy, isLabelShown: false, isBusy: isCreating, isFocused: $isNameFocused)
                    .onSubmit(create)
                if let banner = model.banner {
                    Text(banner.title)
                        .foregroundStyle(banner.lineStyle)
                    BannerActionButton()
                }
                FormButton(title: FirstWorkspaceCopy.create, busyTitle: SheetCopy.creating, kind: .primary, isBusy: isCreating, disabledReason: NameIssue.disabledReason(name: name), isFullWidth: true, action: create)
                    .keyboardShortcut(.defaultAction)
                FormButton(title: FirstWorkspaceCopy.signOut, busyTitle: nil, kind: .quiet, isBusy: false, disabledReason: nil) {
                    windowState.requestSignOut(model: model)
                }
            }
        }
        .multilineTextAlignment(.center)
        .task { isNameFocused = true }
    }

    private var shownIssue: RuleIssue? {
        NameIssue.shown(name: name, serverIssue: model.ruleIssues[.newWorkspace])
    }

    private var isCreating: Bool {
        model.writesInFlight.contains(.newWorkspace)
    }

    private func create() {
        guard NameIssue.disabledReason(name: name) == nil, !isCreating else { return }
        Task { await model.createWorkspace(name: name) }
    }
}
