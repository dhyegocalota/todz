import SwiftUI
import TodzKit

struct NotesPreview: View {
    let notes: String?
    let options: AttributedString.MarkdownParsingOptions

    var body: some View {
        Group {
            if let notes {
                Text(rendered(notes))
            }
            if notes == nil {
                Text(InspectorCopy.notesPlaceholder)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(.rect)
        .environment(\.openURL, OpenURLAction { NoteLink.isOpenable($0) ? .systemAction : .discarded })
    }

    private func rendered(_ notes: String) -> AttributedString {
        do {
            return try AttributedString(markdown: notes, options: options)
        } catch {
            return AttributedString(notes)
        }
    }
}
