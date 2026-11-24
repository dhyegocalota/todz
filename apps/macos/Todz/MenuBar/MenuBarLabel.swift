import SwiftUI
import TodzKit

private let statusSymbol = "checkmark.square"

struct MenuBarLabel: View {
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @Environment(\.openWindow) private var openWindow
    @AppStorage(MenuBarBadge.storageKey) private var isCountEnabled = MenuBarBadge.isEnabledByDefault

    var body: some View {
        let badgeText = MenuBarBadge.text(openCount: model.todayHeadingCount, isEnabled: isCountEnabled)
        HStack {
            Image(systemName: statusSymbol)
            if let badgeText {
                Text(badgeText)
                    .monospacedDigit()
            }
        }
        .accessibilityLabel(accessibilityLabel(badgeText: badgeText))
        .task { await model.launch() }
        .onChange(of: windowState.waitingLink, initial: true) { _, link in
            guard let link else { return }
            windowState.follow(link, model: model)
            openWindow.mainWindow()
        }
        .onChange(of: model.linkRevealCount) {
            windowState.isInspectorPresented = true
        }
    }

    private func accessibilityLabel(badgeText: String?) -> String {
        guard badgeText != nil, let openCount = model.todayHeadingCount else { return MainWindowCopy.windowTitle }
        return AccessibilityCopy.menuBarCount(count: openCount)
    }
}
