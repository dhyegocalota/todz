import SwiftUI
import TodzKit

let menuBarGlyphName = "MenuBarGlyph"

struct MenuBarLabel: View {
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @Environment(ProactiveGate.self) private var gate
    @Environment(DayTemperatureClock.self) private var dayTemperatureClock
    @Environment(\.openWindow) private var openWindow
    @Environment(\.displayScale) private var displayScale
    @AppStorage(MenuBarBadge.storageKey) private var isCountEnabled = MenuBarBadge.isEnabledByDefault
    @AppStorage(DayTemperaturePreference.isOnStorageKey) private var isDayTemperatureOn = DayTemperaturePreference.isOnByDefault
    @State private var isContrastIncreased = NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast

    var body: some View {
        let openCount = model.todayHeadingCount
        let badgeText = MenuBarBadge.text(openCount: openCount, isEnabled: isCountEnabled)
        let countOpacity = DayTemperatureStep.countOpacity(
            step: dayTemperatureClock.step,
            isSettingOn: isDayTemperatureOn,
            isQuiet: gate.isQuiet,
            isContrastIncreased: isContrastIncreased,
            openCount: openCount
        )
        content(badgeText: badgeText, countOpacity: countOpacity)
            .accessibilityLabel(accessibilityLabel(badgeText: badgeText, openCount: openCount))
            .task { await model.launch() }
            .onReceive(NSWorkspace.shared.notificationCenter.publisher(for: NSWorkspace.accessibilityDisplayOptionsDidChangeNotification)) { _ in
                isContrastIncreased = NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast
            }
            .onChange(of: windowState.waitingLink, initial: true) { _, link in
                guard let link else { return }
                windowState.follow(link, model: model)
                openWindow.mainWindow()
            }
            .onChange(of: windowState.waitingSignInLink, initial: true) { _, link in
                guard let link else { return }
                windowState.waitingSignInLink = nil
                if model.showsIncomingSignInLink { openWindow.mainWindow() }
                Task { await model.redeem(signInLink: link) }
            }
            .onChange(of: model.linkRevealCount) {
                windowState.isInspectorPresented = true
            }
    }

    @ViewBuilder
    private func content(badgeText: String?, countOpacity: Double) -> some View {
        switch toneBadgeText(badgeText) {
        case let toneBadgeText?:
            Image(nsImage: MenuBarCountImage.render(badgeText: toneBadgeText, opacity: countOpacity, displayScale: displayScale))
        case nil:
            HStack {
                Image(menuBarGlyphName)
                if let badgeText {
                    Text(badgeText)
                        .monospacedDigit()
                }
            }
        }
    }

    private func toneBadgeText(_ badgeText: String?) -> String? {
        guard isDayTemperatureOn else { return nil }
        return badgeText
    }

    private func accessibilityLabel(badgeText: String?, openCount: Int?) -> String {
        guard badgeText != nil, let openCount else { return MainWindowCopy.windowTitle }
        return AccessibilityCopy.menuBarCount(count: openCount)
    }
}
