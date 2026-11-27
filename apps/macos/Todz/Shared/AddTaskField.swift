import SwiftUI
import TodzKit

private let clearedTitle = ""
private let addSymbol = "plus"

struct AddTaskField<Focus: Hashable>: View {
    let destination: AddTaskDestination
    let selection: AddedTaskSelection
    let focus: FocusState<Focus?>.Binding
    let focusedValue: Focus
    let onEscape: (AddTaskFieldEscape) -> Void
    var onNavigate: ((MenuBarDirection) -> Void)?
    @Environment(AppModel.self) private var model
    @State private var title = clearedTitle
    @State private var localIssue: RuleIssue?

    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                Image(systemName: addSymbol)
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
                TextField(MainWindowCopy.addPlaceholder, text: $title)
                    .textFieldStyle(.plain)
                    .focused(focus, equals: focusedValue)
                    .onSubmit(submit)
                    .accessibilityAction(named: AccessibilityCopy.addTask, submit)
                    .onExitCommand(perform: clear)
                    .onKeyPress(keys: [.upArrow, .downArrow], action: navigate)
                    .onChange(of: destination) {
                        title = clearedTitle
                        localIssue = nil
                    }
                if !isFocused {
                    Text(MenuBarCopy.newTaskKeycap)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .accessibilityHidden(true)
                }
            }
            .padding(.horizontal, FormMetrics.fieldHorizontalPadding)
            .padding(.vertical, FormMetrics.fieldVerticalPadding)
            .modifier(GlassSurface(cornerRadius: FormMetrics.panelCornerRadius))
            .overlay { ring }
            if let shownIssue {
                Text(shownIssue.copy)
                    .foregroundStyle(.red)
            }
        }
        .padding(.horizontal)
    }

    private var ring: some View {
        RoundedRectangle(cornerRadius: FormMetrics.panelCornerRadius, style: .continuous)
            .strokeBorder(Color.accentColor, lineWidth: FormMetrics.focusRingWidth)
            .opacity(isFocused ? 1 : 0)
            .todzAnimation(.snap, value: isFocused)
    }

    private var isFocused: Bool {
        focus.wrappedValue == focusedValue
    }

    private var shownIssue: RuleIssue? {
        guard let localIssue else { return model.ruleIssues[destination.target] }
        return localIssue
    }

    private func navigate(_ press: KeyPress) -> KeyPress.Result {
        guard let onNavigate else { return .ignored }
        onNavigate(press.key == .upArrow ? .up : .down)
        return .handled
    }

    private func clear() {
        let escape: AddTaskFieldEscape = title.isEmpty ? .wasEmpty : .clearedTitle
        title = clearedTitle
        localIssue = nil
        onEscape(escape)
    }

    private func submit() {
        switch AddFieldSubmission.of(title: title) {
        case .ignored:
            return
        case let .refused(issue):
            localIssue = issue
        case let .accepted(submitted):
            localIssue = nil
            title = clearedTitle
            Task { await model.addTask(title: submitted, projectIdentifier: destination.projectIdentifier, dueDate: destination.dueDate, selection: selection) }
        }
    }
}
