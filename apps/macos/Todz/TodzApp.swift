import SwiftUI
import TodzKit

private let defaultWidth: CGFloat = 1100
private let defaultHeight: CGFloat = 700
private let popoverWidth: CGFloat = 360
private let settingsWidth: CGFloat = 420

@main
struct TodzApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        MenuBarBadge.registerDefault(in: .standard)
    }

    var body: some Scene {
        let model = appDelegate.model
        let windowState = appDelegate.windowState
        let gate = appDelegate.gate
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
                .environment(windowState)
        }
        .menuBarExtraStyle(.window)
        Settings {
            SettingsView()
                .frame(width: settingsWidth)
                .environment(model)
                .environment(gate)
        }
        .windowResizability(.contentSize)
    }
}
