import SwiftUI
import TodzKit

private let statusSymbol = "checkmark.square"

struct MenuBarLabel: View {
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Image(systemName: statusSymbol)
            .accessibilityLabel(MainWindowCopy.windowTitle)
            .task { await model.launch() }
            .onChange(of: windowState.waitingLink, initial: true) { _, link in
                guard let link else { return }
                windowState.follow(link, model: model)
                openWindow.mainWindow()
            }
    }
}
