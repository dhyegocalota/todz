import SwiftUI
import TodzKit

private let doneSymbol = "checkmark"
private let collapsedSymbol = "chevron.down"
private let expandedSymbol = "chevron.up"

struct MenuBarDoneToday: View {
    let tasks: [BoardTask]
    let focus: FocusState<MenuBarFocus?>.Binding
    let navigate: (MenuBarDirection) -> Void
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading) {
            disclosure
            if isExpanded {
                ForEach(tasks, id: \.key) { task in
                    MenuBarRow(task: task, isUpNext: false, focus: focus, navigate: navigate)
                }
            }
        }
        .todzMotion(.disclosure, value: isExpanded)
    }

    private var disclosure: some View {
        Button {
            isExpanded.toggle()
        } label: {
            HStack {
                Image(systemName: doneSymbol)
                Text(MenuBarCopy.doneToday(count: tasks.count))
                Spacer()
                Image(systemName: isExpanded ? expandedSymbol : collapsedSymbol)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(.secondary)
        .padding(.horizontal, FormMetrics.fieldHorizontalPadding)
        .padding(.vertical, FormMetrics.fieldVerticalPadding)
        .overlay { ring }
        .padding(.horizontal)
        .focusable()
        .focused(focus, equals: .doneToday)
        .focusEffectDisabled()
        .onKeyPress(keys: [.space, .return]) { _ in
            isExpanded.toggle()
            return .handled
        }
        .onKeyPress(keys: [.upArrow, .downArrow]) { press in
            navigate(press.key == .upArrow ? .up : .down)
            return .handled
        }
        .accessibilityLabel(MenuBarCopy.doneToday(count: tasks.count))
        .accessibilityValue(isExpanded ? AccessibilityCopy.disclosureExpanded : AccessibilityCopy.disclosureCollapsed)
    }

    private var ring: some View {
        RoundedRectangle(cornerRadius: FormMetrics.fieldCornerRadius, style: .continuous)
            .strokeBorder(Color.accentColor, lineWidth: FormMetrics.focusRingWidth)
            .opacity(focus.wrappedValue == .doneToday ? 1 : 0)
            .todzMotion(.focus, value: focus.wrappedValue)
    }
}
