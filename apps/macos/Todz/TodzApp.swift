import SwiftUI
import TodzKit

private let windowIdentifier = "main"
private let defaultWidth: CGFloat = 1100
private let defaultHeight: CGFloat = 700

@main
struct TodzApp: App {
    @State private var model = AppModel(
        service: OwnerAPI(baseURL: AppConfiguration.baseURL),
        vault: FileSessionVault(folder: AppConfiguration.sessionFolder),
        timeZone: .current
    )
    @State private var windowState = MainWindowState()

    var body: some Scene {
        Window(MainWindowCopy.windowTitle, id: windowIdentifier) {
            RootView()
                .environment(model)
                .environment(windowState)
        }
        .defaultSize(width: defaultWidth, height: defaultHeight)
        .windowResizability(.contentMinSize)
        .commands { AppCommands(model: model, windowState: windowState) }
    }
}
