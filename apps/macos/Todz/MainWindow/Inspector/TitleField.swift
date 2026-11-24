import SwiftUI
import TodzKit

struct TitleField: View {
    let task: BoardTask
    let focus: FocusState<MainWindowFocus?>.Binding
    @Environment(AppModel.self) private var model
    @State private var draft: String
    @State private var localIssue: RuleIssue?

    init(task: BoardTask, focus: FocusState<MainWindowFocus?>.Binding) {
        self.task = task
        self.focus = focus
        _draft = State(initialValue: task.task.title)
    }

    var body: some View {
        VStack(alignment: .leading) {
            TextField(task.task.title, text: $draft, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.title2)
                .fontWeight(.semibold)
                .focused(focus, equals: .inspectorTitle)
                .onSubmit(commit)
                .onExitCommand(perform: restore)
            if let shownIssue {
                Text(shownIssue.copy)
                    .foregroundStyle(.red)
            }
        }
        .onChange(of: focus.wrappedValue) { previous, current in
            let isLeavingTheField = previous == .inspectorTitle && current != .inspectorTitle
            guard isLeavingTheField else { return }
            commit()
        }
        .onChange(of: task.task.title) { previous, saved in
            let isOwnerTyping = focus.wrappedValue == .inspectorTitle && draft != previous
            guard !isOwnerTyping else { return }
            draft = saved
        }
        .onDisappear(perform: commit)
    }

    private var shownIssue: RuleIssue? {
        guard let localIssue else { return model.ruleIssue(task: task.key, field: .title) }
        return localIssue
    }

    private func restore() {
        draft = task.task.title
        localIssue = nil
        focus.wrappedValue = .list
    }

    private func commit() {
        guard draft != task.task.title else { return }
        localIssue = TextCheck.issue(ofTitle: draft)
        guard localIssue == nil else { return }
        Task { await model.updateTitle(task: task.key, title: draft) }
    }
}
