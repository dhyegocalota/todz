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
            return Self.withCodeInMonospace(try AttributedString(markdown: notes, options: options))
        } catch {
            return AttributedString(notes)
        }
    }

    private static func withCodeInMonospace(_ parsed: AttributedString) -> AttributedString {
        var styled = parsed
        let codeRanges = parsed.runs[\.inlinePresentationIntent].filter { intent, _ in
            guard let intent else { return false }
            return intent.contains(.code)
        }
        codeRanges.forEach { _, range in styled[range].font = .body.monospaced() }
        return styled
    }
}
