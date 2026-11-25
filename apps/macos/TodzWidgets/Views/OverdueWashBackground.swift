import SwiftUI
import TodzKit
import WidgetKit

private let washCornerRadius: CGFloat = 8

struct OverdueWashBackground: ViewModifier {
    let task: WidgetSnapshotTask
    let widgetDay: WidgetDay
    let isShown: Bool
    @Environment(\.widgetRenderingMode) private var renderingMode
    @Environment(\.colorSchemeContrast) private var colorSchemeContrast

    func body(content: Content) -> some View {
        content.background(wash)
    }

    private var wash: some View {
        RoundedRectangle(cornerRadius: washCornerRadius)
            .fill(washColor.opacity(opacity))
    }

    private var washColor: Color {
        renderingMode == .fullColor ? Color.red : Color.primary
    }

    private var opacity: Double {
        OverdueWash.opacity(
            of: task,
            on: widgetDay.day,
            isShown: isShown,
            isContrastIncreased: colorSchemeContrast == .increased
        )
    }
}

extension View {
    func overdueWash(task: WidgetSnapshotTask, widgetDay: WidgetDay, isShown: Bool) -> some View {
        modifier(OverdueWashBackground(task: task, widgetDay: widgetDay, isShown: isShown))
    }
}
