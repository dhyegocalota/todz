import SwiftUI
import TodzKit

private let noNotes = ""
private let editorMinimumHeight: CGFloat = 120
private let markdownOptions = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)

struct NotesEditor: View {
    let task: BoardTask
    @Environment(AppModel.self) private var model
    @State private var draft: String
    @State private var isEditing = false
    @State private var localIssue: RuleIssue?
    @FocusState private var isFocused: Bool

    init(task: BoardTask) {
        self.task = task
        _draft = State(initialValue: Self.editableText(task.task.notes))
    }

    var body: some View {
        VStack(alignment: .leading) {
            HStack(alignment: .top) {
                if isEditing {
                    TextEditor(text: $draft)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: editorMinimumHeight)
                        .focused($isFocused)
                        .disabled(isSaving)
                        .onAppear { isFocused = true }
                        .onExitCommand(perform: restore)
                }
                if !isEditing {
                    Button(action: beginEditing) {
                        NotesPreview(notes: task.task.notes, options: markdownOptions)
                    }
                    .buttonStyle(.plain)
                    .disabled(isSaving)
                }
                if isSaving {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .padding()
            .background(.fill.quaternary)
            if let shownIssue {
                Text(shownIssue.copy)
                    .foregroundStyle(.red)
            }
        }
        .onChange(of: isFocused) { _, isNowFocused in
            guard !isNowFocused else { return }
            commit()
        }
        .onChange(of: task.task.notes) { _, saved in
            guard !isEditing else { return }
            draft = Self.editableText(saved)
        }
        .onDisappear(perform: commit)
    }

    private var isSaving: Bool {
        model.isSaving(task: task.key, field: .notes)
    }

    private var shownIssue: RuleIssue? {
        guard let localIssue else { return model.ruleIssue(task: task.key, field: .notes) }
        return localIssue
    }

    private static func editableText(_ notes: String?) -> String {
        guard let notes else { return noNotes }
        return notes
    }

    private func beginEditing() {
        draft = Self.editableText(task.task.notes)
        isEditing = true
    }

    private func restore() {
        draft = Self.editableText(task.task.notes)
        localIssue = nil
        isEditing = false
    }

    private func commit() {
        guard isEditing, !isSaving else { return }
        localIssue = TextCheck.issue(ofNotes: draft)
        guard localIssue == nil else { return }
        guard draft != Self.editableText(task.task.notes) else {
            isEditing = false
            return
        }
        let isBlank = draft.allSatisfy(\.isWhitespace)
        let notes: String? = isBlank ? nil : draft
        Task {
            await model.updateNotes(task: task.key, notes: notes)
            guard model.ruleIssue(task: task.key, field: .notes) == nil else { return }
            isEditing = false
        }
    }
}
