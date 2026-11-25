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
        DayClosePreference.registerDefaults(in: .standard)
        MorningGlancePreference.registerDefaults(in: .standard)
        DayTemperaturePreference.registerDefaults(in: .standard)
        RibbonPreference.registerDefaults(in: .standard)
    }

    var body: some Scene {
        let model = appDelegate.model
        let windowState = appDelegate.windowState
        let gate = appDelegate.gate
        let panel = appDelegate.panel
        let dayClose = appDelegate.dayClose
        let morningGlance = appDelegate.morningGlance
        let dayTemperatureClock = appDelegate.dayTemperatureClock
        let ribbon = appDelegate.ribbon
        let ribbonStrips = appDelegate.ribbonStrips
        Window(MainWindowCopy.windowTitle, id: MainWindowScene.identifier) {
            RootView()
                .environment(model)
                .environment(windowState)
        }
        .defaultSize(width: defaultWidth, height: defaultHeight)
        .windowResizability(.contentMinSize)
        .commands { AppCommands(model: model, windowState: windowState, updater: appDelegate.updater) }
        MenuBarExtra {
            MenuBarPopover()
                .frame(width: popoverWidth)
                .environment(model)
                .environment(windowState)
                .environment(panel)
                .environment(dayClose)
                .environment(morningGlance)
                .environment(ribbon)
        } label: {
            MenuBarLabel()
                .environment(model)
                .environment(windowState)
                .environment(gate)
                .environment(dayTemperatureClock)
                .environment(ribbon)
                .environment(ribbonStrips)
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
