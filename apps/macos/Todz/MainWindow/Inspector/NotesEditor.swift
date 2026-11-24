import SwiftUI
import TodzKit

private let noNotes = ""
private let editorMinimumHeight: CGFloat = 120
private let markdownOptions = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)

struct NotesEditor: View {
    let task: BoardTask
    @Environment(AppModel.self) private var model
    @State private var draft: String
    @State private var isEditing: Bool
    @FocusState private var isFocused: Bool

    init(task: BoardTask, unsavedNotes: String?) {
        self.task = task
        _draft = State(initialValue: Self.initialDraft(unsavedNotes: unsavedNotes, savedNotes: task.task.notes))
        _isEditing = State(initialValue: unsavedNotes != nil)
    }

    var body: some View {
        VStack(alignment: .leading) {
            HStack(alignment: .top) {
                if isEditing {
                    TextEditor(text: $draft)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: editorMinimumHeight)
                        .focused($isFocused)
                        .onAppear { isFocused = true }
                        .onExitCommand(perform: restore)
                }
                if !isEditing {
                    Button(action: beginEditing) {
                        NotesPreview(notes: task.task.notes, options: markdownOptions)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
            .background(.fill.quaternary)
            if let issue = model.ruleIssue(task: task.key, field: .notes) {
                Text(issue.copy)
                    .foregroundStyle(.red)
            }
        }
        .onChange(of: isFocused) { _, isNowFocused in
            guard !isNowFocused else { return }
            commit()
        }
        .onChange(of: task.task.notes) { previous, saved in
            let isOwnerTyping = isEditing && draft != Self.editableText(previous)
            guard !isOwnerTyping else { return }
            draft = Self.editableText(saved)
        }
        .onDisappear(perform: commit)
    }

    private static func initialDraft(unsavedNotes: String?, savedNotes: String?) -> String {
        guard let unsavedNotes else { return editableText(savedNotes) }
        return unsavedNotes
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
        model.discardUnsavedNotes(task: task.key)
        draft = Self.editableText(task.task.notes)
        isEditing = false
    }

    private func commit() {
        guard isEditing else { return }
        Task {
            await model.commitNotes(task: task.key, draft: draft)
            guard model.ruleIssue(task: task.key, field: .notes) == nil else { return }
            isEditing = false
        }
    }
}
