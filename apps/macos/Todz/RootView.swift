import SwiftUI
import TodzKit

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        screen
            .task {
                guard model.phase == .loading else { return }
                await model.launch()
            }
    }

    @ViewBuilder private var screen: some View {
        switch model.phase {
        case .loading:
            LoadingScreen()
        case let .signedOut(notice):
            SignInScreen(notice: notice)
        case .naming:
            FirstWorkspaceScreen()
        case .ready:
            if let workspace = model.activeWorkspace {
                MainWindow(workspace: workspace)
            }
        }
    }
}
