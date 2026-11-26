import SwiftUI
import TodzKit

let menuBarGlyphName = "MenuBarGlyph"

struct MenuBarLabel: View {
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @Environment(ProactiveGate.self) private var gate
    @Environment(DayTemperatureClock.self) private var dayTemperatureClock
    @Environment(RibbonCoordinator.self) private var ribbon
    @Environment(MenuBarRibbonStripCache.self) private var ribbonStrips
    @Environment(\.openWindow) private var openWindow
    @Environment(\.displayScale) private var displayScale
    @AppStorage(MenuBarBadge.storageKey) private var isCountEnabled = MenuBarBadge.isEnabledByDefault
    @State private var isContrastIncreased = NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast

    var body: some View {
        let openCount = model.todayHeadingCount
        let badgeText = MenuBarBadge.text(openCount: openCount, isEnabled: isCountEnabled)
        let countOpacity = DayTemperatureStep.countOpacity(
            step: dayTemperatureClock.step,
            isSettingOn: dayTemperatureClock.isOn,
            isQuiet: gate.isQuiet,
            isContrastIncreased: isContrastIncreased,
            openCount: openCount
        )
        content(badgeText: badgeText, countOpacity: countOpacity)
            .accessibilityLabel(accessibilityLabel(badgeText: badgeText, openCount: openCount, presentation: ribbon.presentation))
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
                openWindow.mainWindow()
                Task { await model.redeem(signInLink: link) }
            }
            .onChange(of: windowState.isMainWindowRequested) { _, isRequested in
                guard isRequested else { return }
                windowState.isMainWindowRequested = false
                openWindow.mainWindow()
            }
            .onChange(of: model.linkRevealCount) {
                windowState.isInspectorPresented = true
            }
    }

    @ViewBuilder
    private func content(badgeText: String?, countOpacity: Double) -> some View {
        switch ribbon.presentation {
        case let presentation?:
            MenuBarRibbonLabel(presentation: presentation, displayScale: displayScale, strips: ribbonStrips)
                .equatable()
        case nil:
            countContent(badgeText: badgeText, countOpacity: countOpacity)
        }
    }

    @ViewBuilder
    private func countContent(badgeText: String?, countOpacity: Double) -> some View {
        switch badgeText {
        case let badgeText?:
            MenuBarCountLabel(badgeText: badgeText, opacity: countOpacity, displayScale: displayScale)
                .equatable()
        case nil:
            Image(menuBarGlyphName)
        }
    }

    private func accessibilityLabel(badgeText: String?, openCount: Int?, presentation: RibbonPresentation?) -> String {
        if let presentation { return AccessibilityCopy.menuBarRibbon(presentation.content) }
        guard badgeText != nil, let openCount else { return MainWindowCopy.windowTitle }
        return AccessibilityCopy.menuBarCount(count: openCount)
    }
}
