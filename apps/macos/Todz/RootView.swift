import SwiftUI
import TodzKit

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState

    var body: some View {
        @Bindable var windowState = windowState
        screen
            .todzMotion(.stageChange, value: model.phase)
            .task {
                guard model.phase == .loading else { return }
                await model.launch()
            }
            .confirmationDialog(
                SyncCopy.signOutTitle(count: model.waitingChangeCount),
                isPresented: $windowState.isConfirmingSignOut,
                titleVisibility: .visible
            ) {
                Button(MainWindowCopy.signOut, role: .destructive) {
                    Task { await model.signOut() }
                }
                Button(SheetCopy.cancel, role: .cancel) {}
                    .keyboardShortcut(.defaultAction)
            } message: {
                Text(SyncCopy.signOutMessage)
            }
    }

    @ViewBuilder private var choosing: some View {
        if model.workspaceLock.isLocked {
            LoadingScreen()
                .overlay(alignment: .bottom) {
                    Button(WorkspaceLockCopy.switchWorkspace) { Task { await confirmWorkspaceChoice() } }
                        .padding()
                }
                .task { await confirmWorkspaceChoice() }
        }
        if !model.workspaceLock.isLocked {
            WorkspacePickerScreen()
        }
    }

    private func confirmWorkspaceChoice() async {
        _ = await model.beginWorkspaceSwitch()
        model.announceConfirmationFailure()
    }

    @ViewBuilder private var screen: some View {
        switch model.phase {
        case .loading:
            LoadingScreen()
        case let .signedOut(notice):
            SignInScreen(notice: notice)
        case .naming:
            FirstWorkspaceScreen()
        case .choosing:
            choosing
        case .ready:
            if let workspace = model.activeWorkspace {
                MainWindow(workspace: workspace)
            }
        }
    }
}
