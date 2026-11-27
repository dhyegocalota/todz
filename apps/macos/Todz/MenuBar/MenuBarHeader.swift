import SwiftUI
import TodzKit

private let openWindowSymbol = "arrow.up.forward.app"

struct MenuBarHeader: View {
    let workspace: Workspace
    let day: MenuBarDay
    let notice: MenuBarNotice
    @Environment(MenuBarPanel.self) private var panel
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        HStack {
            WorkspaceSwitcher(workspace: workspace, isMainWindow: false)
                .help(workspace.name)
            status
            Button {
                panel.openMainWindow(openWindow)
            } label: {
                Image(systemName: openWindowSymbol)
            }
            .buttonStyle(.borderless)
            .foregroundStyle(.secondary)
            .keyboardShortcut(MenuBarShortcut.openWindow)
            .help(MenuBarCopy.openWindowHelp)
            .accessibilityLabel(MenuBarCopy.openWindow)
            MenuBarMoreMenu(showsUpdateDot: notice.showsUpdateDot)
        }
        .padding(.trailing)
    }

    @ViewBuilder private var status: some View {
        switch day.screen {
        case .active: progress(title: MenuBarCopy.left(count: day.leftCount))
        case .closingDay: progress(title: MenuBarCopy.closeTheDay)
        case .allDone: progress(title: MenuBarCopy.allDoneTitle)
        case .loading, .failed, .dayClosed, .empty: EmptyView()
        }
    }

    private func progress(title: String) -> some View {
        let total = day.leftCount + day.doneCount
        return HStack {
            MenuBarDayRing(progress: day.progress)
            Text(title)
                .font(.title3.weight(.semibold))
                .lineLimit(1)
                .todzCountTransition()
                .todzAnimation(.snap, value: title)
        }
        .fixedSize()
        .help(MenuBarCopy.progress(done: day.doneCount, total: total))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(MenuBarCopy.todayProgress(left: day.leftCount, done: day.doneCount, total: total))
    }
}
