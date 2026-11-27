import SwiftUI
import TodzKit

private let defaultWidth: CGFloat = 1100
private let defaultHeight: CGFloat = 700
private let popoverWidth: CGFloat = 360
private let settingsWidth: CGFloat = 520
private let settingsMinimumWidth: CGFloat = 460
private let settingsHeight: CGFloat = 640
private let settingsMinimumHeight: CGFloat = 420

@main
struct TodzApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        MenuBarBadge.registerDefault(in: .standard)
        DayClosePreference.registerDefaults(in: .standard)
        MorningGlancePreference.registerDefaults(in: .standard)
        DayTemperaturePreference.registerDefaults(in: .standard)
        UsageSharingPreference.registerDefaults(in: .standard)
        RibbonPreference.registerDefaults(in: .standard)
        MenuBarOnlyPreference.registerDefaults(in: .standard)
        RespectFocusPreference.registerDefaults(in: .standard)
        WorkspaceShortcutsPreference.registerDefaults(in: .standard)
        WorkspaceLockPreference.registerDefaults(in: .standard)
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
        let countRoll = appDelegate.countRoll
        Window(MainWindowCopy.windowTitle, id: MainWindowScene.identifier) {
            RootView()
                .environment(model)
                .environment(windowState)
        }
        .defaultSize(width: defaultWidth, height: defaultHeight)
        .windowResizability(.contentMinSize)
        .commands { AppCommands(model: model, windowState: windowState, updater: appDelegate.updater, shortcuts: appDelegate.workspaceShortcuts) }
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
                .environment(countRoll)
                .environment(appDelegate.updater)
        }
        .menuBarExtraStyle(.window)
        Settings {
            SettingsView()
                .frame(minWidth: settingsMinimumWidth, idealWidth: settingsWidth, minHeight: settingsMinimumHeight, idealHeight: settingsHeight)
                .environment(model)
                .environment(gate)
                .environment(appDelegate.updater)
                .environment(appDelegate.workspaceShortcuts)
        }
        .defaultSize(width: settingsWidth, height: settingsHeight)
        .windowResizability(.contentMinSize)
    }
}
