import SwiftUI
import TodzKit

private let openSymbol = "circle"
private let checkLineWidth: CGFloat = 1.6

struct TaskCheckbox: View {
    let task: BoardTask
    let item: SidebarItem
    @Environment(AppModel.self) private var model
    @Environment(MainWindowState.self) private var windowState
    @Environment(\.accessibilityReduceMotion) private var isReduceMotionOn

    var body: some View {
        Button {
            windowState.toggleDone(task: task.key, item: item, model: model)
        } label: {
            Image(systemName: openSymbol)
                .foregroundStyle(Color.secondary)
                .opacity(task.isDone ? 0 : 1)
                .background {
                    Circle()
                        .fill(Color.accentColor)
                        .opacity(task.isDone ? 1 : 0)
                }
                .overlay {
                    CheckmarkMark()
                        .trim(from: 0, to: task.isDone ? 1 : 0)
                        .stroke(Color.white, style: StrokeStyle(lineWidth: checkLineWidth, lineCap: .round, lineJoin: .round))
                        .transaction { if isReduceMotionOn { $0.animation = nil } }
                        .opacity(task.isDone ? 1 : 0)
                }
                .overlay {
                    if !isReduceMotionOn {
                        SparkleBurst(isBursting: task.isDone)
                    }
                }
                .todzAnimation(.draw, value: task.isDone)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.isToggle)
    }

    private var accessibilityLabel: String {
        guard task.isDone else { return AccessibilityCopy.checkboxOpen(title: task.task.title) }
        return AccessibilityCopy.checkboxDone(title: task.task.title)
    }
}
