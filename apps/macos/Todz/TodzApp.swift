import SwiftUI
import TodzKit
import WidgetKit

private let cacheFolderName = "Cache"
private let defaultWidth: CGFloat = 1100
private let defaultHeight: CGFloat = 700
private let popoverWidth: CGFloat = 360

@main
struct TodzApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var model = AppModel(
        service: OwnerAPI(baseURL: AppConfiguration.baseURL),
        vault: FileSessionVault(folder: AppConfiguration.sessionFolder),
        store: FileSyncStore(folder: AppConfiguration.sessionFolder.appending(path: cacheFolderName)),
        widgetStore: AppConfiguration.widgetStore,
        reloadWidgets: { WidgetCenter.shared.reloadAllTimelines() },
        signals: SocketChangeSignals(baseURL: AppConfiguration.baseURL),
        timeZone: .current,
        pause: { try await Task.sleep(for: $0) }
    )
    @State private var windowState = MainWindowState()

    var body: some Scene {
        Window(MainWindowCopy.windowTitle, id: MainWindowScene.identifier) {
            RootView()
                .environment(model)
                .environment(windowState)
        }
        .defaultSize(width: defaultWidth, height: defaultHeight)
        .windowResizability(.contentMinSize)
        .commands { AppCommands(model: model, windowState: windowState) }
        MenuBarExtra {
            MenuBarPopover()
                .frame(width: popoverWidth)
                .environment(model)
                .environment(windowState)
        } label: {
            MenuBarLabel()
                .environment(model)
        }
        .menuBarExtraStyle(.window)
    }
}
