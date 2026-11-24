import SwiftUI
import TodzKit

private let clearedTitle = ""

struct AddTaskField: View {
    let destination: AddTaskDestination
    let focus: FocusState<MainWindowFocus?>.Binding
    @Environment(AppModel.self) private var model
    @State private var title = clearedTitle
    @State private var localIssue: RuleIssue?

    var body: some View {
        VStack(alignment: .leading) {
            TextField(MainWindowCopy.addPlaceholder, text: $title)
                .textFieldStyle(.plain)
                .focused(focus, equals: .addField)
                .onSubmit(submit)
                .onExitCommand(perform: clear)
                .padding()
                .background(.fill.quaternary)
            if let shownIssue {
                Text(shownIssue.copy)
                    .foregroundStyle(.red)
            }
        }
        .padding(.horizontal)
    }

    private var shownIssue: RuleIssue? {
        guard let localIssue else { return model.ruleIssues[destination.target] }
        return localIssue
    }

    private func clear() {
        title = clearedTitle
        localIssue = nil
        focus.wrappedValue = .list
    }

    private func submit() {
        let isBlank = title.allSatisfy(\.isWhitespace)
        guard !isBlank else { return }
        localIssue = TextCheck.issue(ofTitle: title)
        guard localIssue == nil else { return }
        let submitted = title
        title = clearedTitle
        Task { await model.addTask(title: submitted, projectIdentifier: destination.projectIdentifier, dueDate: destination.dueDate) }
    }
}
